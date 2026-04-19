import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import { config, getElasticsearchNode } from '../config/index.js';
import { getPrisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { RepositoryService } from './repository.service.js';
import { UserDataPermissionService } from './user-data-permission.service.js';
import type { Document } from '@prisma/client';

export interface SearchOptions {
  query: string;
  repositoryId?: string;
  type?: 'file' | 'folder' | 'all';
  extensions?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  creatorId?: string;
  page?: number;
  pageSize?: number;
  userId?: string;
  bypassDataScope?: boolean;
}

export interface SearchResult {
  documents: Array<{
    id: string;
    name: string;
    path: string;
    type: string;
    size: bigint;
    mimeType: string | null;
    repositoryId: string;
    highlights?: string[];
    score?: number;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

export interface AISearchOptions extends SearchOptions {
  useSemanticSearch?: boolean;
  generateSummary?: boolean;
}

export class SearchService {
  private static esClient: ElasticsearchClient | null = null;
  private static readonly INDEX_NAME = 'wenyu_documents';

  private static async getAccessibleRepositoryIdsForSearch(
    userId: string,
    bypassDataScope: boolean = false
  ): Promise<string[] | null> {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        departmentId: true,
        roles: {
          select: {
            roleId: true,
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    const ctx = await UserDataPermissionService.getAccessScopeContext(userId);
    if (ctx.isSystemAdmin || bypassDataScope) {
      return null;
    }

    const roleIds = user.roles.map((role) => role.roleId);
    const accessibleByPermission = await RepositoryService.findAccessible(
      userId,
      roleIds,
      user.departmentId ?? undefined
    );
    // 与 /repositories/accessible 保持一致，只在“用户可访问仓库”内搜索。
    return accessibleByPermission.map((repo) => repo.id);
  }

  static getElasticsearchClient(): ElasticsearchClient {
    if (!this.esClient) {
      this.esClient = new ElasticsearchClient({
        node: getElasticsearchNode(),
        auth: config.ELASTICSEARCH_USERNAME
          ? {
              username: config.ELASTICSEARCH_USERNAME,
              password: config.ELASTICSEARCH_PASSWORD || '',
            }
          : undefined,
      });
    }
    return this.esClient;
  }

  static async initIndex(): Promise<void> {
    const client = this.getElasticsearchClient();

    const exists = await client.indices.exists({ index: this.INDEX_NAME });
    if (!exists) {
      await client.indices.create({
        index: this.INDEX_NAME,
        body: {
          settings: {
            analysis: {
              analyzer: {
                chinese_analyzer: {
                  type: 'custom',
                  tokenizer: 'ik_max_word',
                  filter: ['lowercase'],
                },
              },
            },
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              repositoryId: { type: 'keyword' },
              name: {
                type: 'text',
                analyzer: 'chinese_analyzer',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              path: { type: 'keyword' },
              type: { type: 'keyword' },
              extension: { type: 'keyword' },
              mimeType: { type: 'keyword' },
              content: {
                type: 'text',
                analyzer: 'chinese_analyzer',
              },
              creatorId: { type: 'keyword' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
              size: { type: 'long' },
              tags: { type: 'keyword' },
            },
          },
        },
      });

      logger.info('Elasticsearch index created');
    }
  }

  static async indexDocument(document: Document, content?: string): Promise<void> {
    const client = this.getElasticsearchClient();

    await client.index({
      index: this.INDEX_NAME,
      id: document.id,
      body: {
        id: document.id,
        repositoryId: document.repositoryId,
        name: document.name,
        path: document.path,
        type: document.type,
        extension: document.extension,
        mimeType: document.mimeType,
        content: content || '',
        creatorId: document.creatorId,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        size: Number(document.size),
      },
    });
  }

  static async removeDocument(documentId: string): Promise<void> {
    const client = this.getElasticsearchClient();

    try {
      await client.delete({
        index: this.INDEX_NAME,
        id: documentId,
      });
    } catch (error) {
      logger.warn(`Failed to remove document from index: ${documentId}`);
    }
  }

  static async search(options: SearchOptions): Promise<SearchResult> {
    const client = this.getElasticsearchClient();
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;

    const must: object[] = [];
    const filter: object[] = [];

    // 仓库权限过滤
    if (options.userId) {
      const accessibleRepoIds = await this.getAccessibleRepositoryIdsForSearch(
        options.userId,
        options.bypassDataScope === true
      );
      if (accessibleRepoIds !== null) {
        if (accessibleRepoIds.length > 0) {
          filter.push({ terms: { repositoryId: accessibleRepoIds } });
        } else {
          // 无任何可访问的仓库，返回空结果
          filter.push({ term: { repositoryId: '__no_access__' } });
        }
      }
    }

    if (options.query) {
      must.push({
        multi_match: {
          query: options.query,
          fields: ['name^3', 'content', 'path'],
          type: 'best_fields',
        },
      });
    }

    if (options.repositoryId) {
      filter.push({ term: { repositoryId: options.repositoryId } });
    }

    if (options.type && options.type !== 'all') {
      filter.push({ term: { type: options.type.toUpperCase() } });
    }

    if (options.extensions && options.extensions.length > 0) {
      filter.push({ terms: { extension: options.extensions } });
    }

    if (options.creatorId) {
      filter.push({ term: { creatorId: options.creatorId } });
    }

    if (options.dateFrom || options.dateTo) {
      const range: { gte?: string; lte?: string } = {};
      if (options.dateFrom) {
        range.gte = options.dateFrom.toISOString();
      }
      if (options.dateTo) {
        range.lte = options.dateTo.toISOString();
      }
      filter.push({ range: { createdAt: range } });
    }

    const response = await client.search({
      index: this.INDEX_NAME,
      body: {
        from: (page - 1) * pageSize,
        size: pageSize,
        query: {
          bool: {
            must: must.length > 0 ? must : [{ match_all: {} }],
            filter,
          },
        },
        highlight: {
          fields: {
            name: {},
            content: { fragment_size: 150, number_of_fragments: 3 },
          },
        },
        sort: [
          { _score: { order: 'desc' } },
          { updatedAt: { order: 'desc' } },
        ],
      },
    });

    const hits = response.hits.hits;
    const total = typeof response.hits.total === 'number'
      ? response.hits.total
      : response.hits.total?.value || 0;

    const documents = hits.map((hit) => {
      const source = hit._source as Record<string, unknown>;
      const highlights: string[] = [];

      if (hit.highlight) {
        const hl = hit.highlight as Record<string, string[]>;
        if (hl.content) {
          highlights.push(...hl.content);
        }
        if (hl.name) {
          highlights.push(...hl.name);
        }
      }

      return {
        id: source.id as string,
        name: source.name as string,
        path: source.path as string,
        type: source.type as string,
        size: BigInt(source.size as number),
        mimeType: source.mimeType as string | null,
        repositoryId: source.repositoryId as string,
        highlights,
        score: hit._score || 0,
      };
    });

    return {
      documents,
      total,
      page,
      pageSize,
    };
  }

  static async simpleSearch(options: SearchOptions): Promise<SearchResult> {
    const prisma = getPrisma();
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {
      status: 'NORMAL',
    };

    // 仓库权限过滤
    if (options.userId) {
      const accessibleRepoIds = await this.getAccessibleRepositoryIdsForSearch(
        options.userId,
        options.bypassDataScope === true
      );
      if (accessibleRepoIds !== null) {
        if (accessibleRepoIds.length > 0) {
          where.repositoryId = { in: accessibleRepoIds };
        } else {
          // 无任何可访问的仓库，返回空结果
          where.repositoryId = '__no_access__';
        }
      }
    }

    if (options.query) {
      where.OR = [
        { name: { contains: options.query } },
        { path: { contains: options.query } },
      ];
    }

    if (options.repositoryId) {
      where.repositoryId = options.repositoryId;
    }

    if (options.type && options.type !== 'all') {
      where.type = options.type.toUpperCase();
    }

    if (options.extensions && options.extensions.length > 0) {
      where.extension = { in: options.extensions };
    }

    if (options.creatorId) {
      where.creatorId = options.creatorId;
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.document.count({ where }),
    ]);

    return {
      documents: documents.map((doc) => ({
        id: doc.id,
        name: doc.name,
        path: doc.path,
        type: doc.type,
        size: doc.size,
        mimeType: doc.mimeType,
        repositoryId: doc.repositoryId,
      })),
      total,
      page,
      pageSize,
    };
  }

  static async extractContent(document: Document, buffer: Buffer): Promise<string> {
    try {
      const ext = document.extension?.toLowerCase();

      switch (ext) {
        case '.txt':
        case '.md':
        case '.json':
        case '.xml':
        case '.html':
        case '.css':
        case '.js':
        case '.ts':
          return buffer.toString('utf-8').slice(0, 100000);

        case '.pdf':
          const pdfData = await pdf(buffer);
          return pdfData.text.slice(0, 100000);

        case '.docx':
          const docResult = await mammoth.extractRawText({ buffer });
          return docResult.value.slice(0, 100000);

        case '.xlsx':
        case '.xls':
          const workbook = xlsx.read(buffer, { type: 'buffer' });
          let xlsContent = '';
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            xlsContent += xlsx.utils.sheet_to_txt(sheet) + '\n';
          }
          return xlsContent.slice(0, 100000);

        default:
          return '';
      }
    } catch (error) {
      logger.error(`Failed to extract content from ${document.name}:`, error);
      return '';
    }
  }

  static async reindexRepository(repositoryId: string): Promise<void> {
    const prisma = getPrisma();
    const repo = await RepositoryService.findById(repositoryId);

    if (!repo) {
      throw new Error('Repository not found');
    }

    const documents = await prisma.document.findMany({
      where: {
        repositoryId,
        type: 'FILE',
        status: 'NORMAL',
      },
    });

    const adapter = await RepositoryService.getStorageAdapter(repo);

    for (const doc of documents) {
      try {
        const storagePath = `${repositoryId}${doc.path}`;
        const buffer = await adapter.read(storagePath);
        const content = await this.extractContent(doc, buffer);
        await this.indexDocument(doc, content);
      } catch (error) {
        logger.error(`Failed to index document ${doc.id}:`, error);
      }
    }

    logger.info(`Reindexed ${documents.length} documents for repository ${repositoryId}`);
  }
}
