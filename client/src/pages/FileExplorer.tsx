import { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Card,
  List,
  Button,
  Space,
  Breadcrumb,
  Upload,
  Modal,
  Input,
  Dropdown,
  App,
  Spin,
  Empty,
  Typography,
} from 'antd';
import {
  FolderOutlined,
  FileOutlined,
  UploadOutlined,
  FolderAddOutlined,
  DeleteOutlined,
  EditOutlined,
  DownloadOutlined,
  ShareAltOutlined,
  MoreOutlined,
  HomeOutlined,
  ReloadOutlined,
  ArrowUpOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositoryApi, documentApi, searchApi, Document, Repository, SearchResult } from '../services/api';
import { useFileExplorerStore } from '../stores/fileExplorerStore';
import { useCompanyScopeStore } from '../stores/companyScopeStore';
import ShareModal from '../components/ShareModal';
import VersionModal from '../components/VersionModal';

const { Text } = Typography;

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.css',
  '.scss',
  '.html',
  '.htm',
  '.xml',
  '.yaml',
  '.yml',
  '.ini',
  '.conf',
  '.csv',
  '.log',
  '.sql',
  '.sh',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.vue',
]);

const OFFICE_EXTENSIONS = new Set([
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
]);

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp',
  '.svg',
]);

const PDF_EXTENSIONS = new Set(['.pdf']);

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.avi',
  '.mov',
  '.mkv',
  '.webm',
]);

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.aac',
  '.flac',
  '.ogg',
]);

const FileExplorer: React.FC = () => {
  const { message } = App.useApp();
  const { repoId } = useParams<{ repoId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    currentRepository,
    currentPath,
    selectedDocuments,
    setCurrentRepository,
    setCurrentPath,
    setSelectedDocuments,
    navigateTo,
    navigateUp,
  } = useFileExplorerStore();

  // 获取公司范围数据
  const {
    selectedCompanyCode,
    userRepositories,
    isAllRepositories,
  } = useCompanyScopeStore();

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDoc, setRenameDoc] = useState<Document | null>(null);
  const [newName, setNewName] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDoc, setShareDoc] = useState<Document | null>(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionDoc, setVersionDoc] = useState<Document | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const isSearching = debouncedSearch.length > 0;

  const { data: reposData, isLoading: reposLoading } = useQuery({
    queryKey: ['accessible-repos'],
    queryFn: () => repositoryApi.accessible(),
  });

  const { data: documentsData, isLoading: docsLoading, refetch } = useQuery({
    queryKey: ['documents', repoId, currentPath],
    queryFn: () => documentApi.list(repoId!, { path: currentPath }),
    enabled: !!repoId,
  });

  const { data: searchData, isLoading: searchLoading, isError: searchFailed, error: searchError } = useQuery({
    queryKey: ['repo-search', repoId, debouncedSearch],
    queryFn: () =>
      searchApi.search({
        query: debouncedSearch,
        repositoryId: repoId!,
        page: 1,
        pageSize: 100,
      }),
    enabled: !!repoId && isSearching,
  });

  // 根据选中公司过滤仓库列表
  const filteredRepositories = useMemo(() => {
    const allRepos = reposData?.data.data || [];

    // 先按用户仓库权限过滤
    let repos = allRepos;
    if (!isAllRepositories && userRepositories.length > 0) {
      const allowedIds = new Set(userRepositories.map((r) => r.id));
      repos = repos.filter((r) => allowedIds.has(r.id));
    }

    // 再按选中公司过滤
    if (selectedCompanyCode) {
      repos = repos.filter((r) => r.companyCode === selectedCompanyCode);
    }

    return repos;
  }, [reposData, selectedCompanyCode, userRepositories, isAllRepositories]);

  useEffect(() => {
    setCurrentPath('/');
  }, [repoId, setCurrentPath]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setSearchInput('');
    setDebouncedSearch('');
  }, [repoId]);

  useEffect(() => {
    if (isSearching) {
      setSelectedDocuments([]);
    }
  }, [isSearching, setSelectedDocuments]);

  useEffect(() => {
    if (repoId && reposData?.data.data) {
      const repo = reposData.data.data.find((r) => r.id === repoId);
      if (repo && (!currentRepository || currentRepository.id !== repo.id)) {
        setCurrentRepository(repo);
      }
    }
  }, [repoId, reposData, currentRepository, setCurrentRepository]);

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => documentApi.upload(repoId!, formData),
    onSuccess: () => {
      message.success('上传成功');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: (name: string) =>
      documentApi.createFolder(repoId!, { name, parentPath: currentPath }),
    onSuccess: () => {
      message.success('文件夹创建成功');
      setCreateFolderOpen(false);
      setFolderName('');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentApi.delete(id),
    onSuccess: () => {
      message.success('删除成功');
      setSelectedDocuments([]);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      documentApi.rename(id, name),
    onSuccess: () => {
      message.success('重命名成功');
      setRenameOpen(false);
      setRenameDoc(null);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('parentPath', currentPath);
    await uploadMutation.mutateAsync(formData);
    return false;
  };

  const handleDownload = async (doc: Document) => {
    try {
      const response = await documentApi.download(doc.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      message.error('下载失败');
    }
  };

  const handlePreview = async (doc: Document) => {
    try {
      const response = await documentApi.preview(doc.id);
      const blob = new Blob([response.data], { type: doc.mimeType || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      // 延迟释放 URL，确保新窗口有时间加载
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      message.error('预览失败');
    }
  };

  const handleDoubleClick = (doc: Document) => {
    if (doc.type === 'FOLDER') {
      navigateTo(doc.path);
    } else {
      const extension = (doc.extension || '').toLowerCase();
      const isTextFile =
        (doc.mimeType?.startsWith('text/') ?? false) || TEXT_EXTENSIONS.has(extension);
      const isOfficeFile = OFFICE_EXTENSIONS.has(extension);
      const isImageFile = IMAGE_EXTENSIONS.has(extension);
      const isPdfFile = PDF_EXTENSIONS.has(extension);
      const isVideoFile = VIDEO_EXTENSIONS.has(extension);
      const isAudioFile = AUDIO_EXTENSIONS.has(extension);

      if (isTextFile) {
        navigate(`/files/${repoId}/editor/${doc.id}`);
      } else if (isOfficeFile) {
        navigate(`/files/${repoId}/office/${doc.id}`);
      } else if (isImageFile || isPdfFile || isVideoFile || isAudioFile) {
        // 这些文件类型通过 blob URL 预览
        handlePreview(doc);
      } else {
        handlePreview(doc);
      }
    }
  };

  const getFileExtension = (fileName: string): string => {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : '';
  };

  const handleSearchResultOpen = async (result: SearchResult) => {
    if (result.type === 'FOLDER') {
      navigateTo(result.path);
      setSearchInput('');
      setDebouncedSearch('');
      return;
    }

    const extension = getFileExtension(result.name);
    const isTextFile = (result.mimeType?.startsWith('text/') ?? false) || TEXT_EXTENSIONS.has(extension);
    const isOfficeFile = OFFICE_EXTENSIONS.has(extension);
    const isImageFile = IMAGE_EXTENSIONS.has(extension);
    const isPdfFile = PDF_EXTENSIONS.has(extension);
    const isVideoFile = VIDEO_EXTENSIONS.has(extension);
    const isAudioFile = AUDIO_EXTENSIONS.has(extension);

    if (isTextFile) {
      navigate(`/files/${result.repositoryId}/editor/${result.id}`);
    } else if (isOfficeFile) {
      navigate(`/files/${result.repositoryId}/office/${result.id}`);
    } else if (isImageFile || isPdfFile || isVideoFile || isAudioFile) {
      try {
        const response = await documentApi.preview(result.id);
        const blob = new Blob([response.data], { type: result.mimeType || 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      } catch (error) {
        message.error('预览失败');
      }
    } else {
      try {
        const response = await documentApi.preview(result.id);
        const blob = new Blob([response.data], { type: result.mimeType || 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      } catch (error) {
        message.error('预览失败');
      }
    }
  };

  const getContextMenuItems = (doc: Document) => [
    {
      key: 'download',
      icon: <DownloadOutlined />,
      label: '下载',
      disabled: doc.type === 'FOLDER',
      onClick: () => handleDownload(doc),
    },
    {
      key: 'rename',
      icon: <EditOutlined />,
      label: '重命名',
      onClick: () => {
        setRenameDoc(doc);
        setNewName(doc.name);
        setRenameOpen(true);
      },
    },
    {
      key: 'share',
      icon: <ShareAltOutlined />,
      label: '分享',
      onClick: () => {
        setShareDoc(doc);
        setShareOpen(true);
      },
    },
    {
      key: 'versions',
      icon: <FileOutlined />,
      label: '版本历史',
      disabled: doc.type === 'FOLDER',
      onClick: () => {
        setVersionDoc(doc);
        setVersionOpen(true);
      },
    },
    { type: 'divider' as const },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      danger: true,
      onClick: () => {
        Modal.confirm({
          title: '确认删除',
          content: `确定要删除"${doc.name}"吗？`,
          onOk: () => deleteMutation.mutate(doc.id),
        });
      },
    },
  ];

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const breadcrumbItems = [
    { title: <HomeOutlined onClick={() => navigate('/files')} style={{ cursor: 'pointer' }} /> },
    ...(currentRepository ? [{ title: currentRepository.name }] : []),
    ...currentPath
      .split('/')
      .filter(Boolean)
      .map((part, index, arr) => ({
        title: (
          <span
            style={{ cursor: 'pointer' }}
            onClick={() => navigateTo('/' + arr.slice(0, index + 1).join('/'))}
          >
            {part}
          </span>
        ),
      })),
  ];

  const documents = documentsData?.data.data || [];
  const searchResults = searchData?.data.data || [];
  const searchErrorMessage = searchFailed
    ? (searchError instanceof Error ? searchError.message : '仓库内搜索失败，请稍后重试')
    : '';

  if (!repoId) {
    return (
      <div>
        <Card title="选择仓库">
          {reposLoading ? (
            <Spin />
          ) : filteredRepositories.length === 0 ? (
            <Empty description="暂无可访问的仓库" />
          ) : (
            <List
              grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4 }}
              dataSource={filteredRepositories}
              renderItem={(repo: Repository) => (
                <List.Item>
                  <Card
                    hoverable
                    onClick={() => {
                      setCurrentRepository(repo);
                      navigate(`/files/${repo.id}`);
                    }}
                  >
                    <Card.Meta
                      avatar={<FolderOutlined style={{ fontSize: 32, color: '#1890ff' }} />}
                      title={repo.name}
                      description={
                        <Space direction="vertical" size={0}>
                          <Text type="secondary">{repo.fileCount} 个文件</Text>
                          <Text type="secondary">{formatSize(repo.totalSize)}</Text>
                        </Space>
                      }
                    />
                  </Card>
                </List.Item>
              )}
            />
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="file-explorer">
      <div className="breadcrumb-nav">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      <div className="toolbar">
        <Upload
          showUploadList={false}
          beforeUpload={handleUpload}
          multiple
        >
          <Button icon={<UploadOutlined />} type="primary">
            上传文件
          </Button>
        </Upload>
        <Button icon={<FolderAddOutlined />} onClick={() => setCreateFolderOpen(true)}>
          新建文件夹
        </Button>
        <Button
          icon={<ArrowUpOutlined />}
          onClick={() => navigateUp()}
          disabled={currentPath === '/'}
        >
          上一级
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
          刷新
        </Button>
        <Input
          allowClear
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="在当前仓库内搜索文件名或内容"
          prefix={<SearchOutlined />}
          style={{ width: 360, marginLeft: 'auto' }}
        />
        {selectedDocuments.length > 0 && (
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={() => {
              Modal.confirm({
                title: '批量删除',
                content: `确定要删除选中的 ${selectedDocuments.length} 个项目吗？`,
                onOk: async () => {
                  for (const doc of selectedDocuments) {
                    await deleteMutation.mutateAsync(doc.id);
                  }
                },
              });
            }}
          >
            删除选中 ({selectedDocuments.length})
          </Button>
        )}
      </div>

      {isSearching ? (
        searchLoading ? (
          <Spin />
        ) : searchFailed ? (
          <Alert type="error" showIcon message="搜索失败" description={searchErrorMessage} />
        ) : searchResults.length === 0 ? (
          <Empty description={`当前仓库未找到“${debouncedSearch}”`} />
        ) : (
          <List
            dataSource={searchResults}
            renderItem={(item: SearchResult) => (
              <List.Item
                className="file-item"
                style={{ cursor: 'pointer' }}
                onClick={() => handleSearchResultOpen(item)}
              >
                <List.Item.Meta
                  avatar={
                    item.type === 'FOLDER' ? (
                      <FolderOutlined style={{ fontSize: 24, color: '#faad14' }} />
                    ) : (
                      <FileOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                    )
                  }
                  title={
                    <Space>
                      <Text strong>{item.name}</Text>
                      {typeof item.score === 'number' ? (
                        <Text type="secondary">相关度 {item.score.toFixed(2)}</Text>
                      ) : null}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary">{item.path}</Text>
                      <Text type="secondary">{formatSize(item.size)}</Text>
                      {item.highlights && item.highlights.length > 0 ? (
                        <span
                          className="search-highlight"
                          dangerouslySetInnerHTML={{ __html: item.highlights[0] }}
                        />
                      ) : null}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )
      ) : docsLoading ? (
        <Spin />
      ) : documents.length === 0 ? (
        <Empty description="文件夹为空">
          <Upload showUploadList={false} beforeUpload={handleUpload}>
            <Button type="primary">上传文件</Button>
          </Upload>
        </Empty>
      ) : (
        <List
          dataSource={documents}
          renderItem={(doc: Document) => (
            <List.Item
              className={`file-item ${selectedDocuments.some((d) => d.id === doc.id) ? 'selected' : ''}`}
              onClick={() => {
                if (selectedDocuments.some((d) => d.id === doc.id)) {
                  setSelectedDocuments(selectedDocuments.filter((d) => d.id !== doc.id));
                } else {
                  setSelectedDocuments([...selectedDocuments, doc]);
                }
              }}
              onDoubleClick={() => handleDoubleClick(doc)}
            >
              <List.Item.Meta
                avatar={
                  doc.type === 'FOLDER' ? (
                    <FolderOutlined style={{ fontSize: 24, color: '#faad14' }} />
                  ) : (
                    <FileOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                  )
                }
                title={doc.name}
                description={
                  <Space>
                    <Text type="secondary">{formatSize(doc.size)}</Text>
                    <Text type="secondary">{formatDate(doc.updatedAt)}</Text>
                    {doc.creator && <Text type="secondary">{doc.creator.name}</Text>}
                  </Space>
                }
              />
              <Dropdown menu={{ items: getContextMenuItems(doc) }} trigger={['click']}>
                <Button
                  type="text"
                  icon={<MoreOutlined />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Dropdown>
            </List.Item>
          )}
        />
      )}

      <Modal
        title="新建文件夹"
        open={createFolderOpen}
        onOk={() => createFolderMutation.mutate(folderName)}
        onCancel={() => {
          setCreateFolderOpen(false);
          setFolderName('');
        }}
        confirmLoading={createFolderMutation.isPending}
      >
        <Input
          placeholder="请输入文件夹名称"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
        />
      </Modal>

      <Modal
        title="重命名"
        open={renameOpen}
        onOk={() => renameDoc && renameMutation.mutate({ id: renameDoc.id, name: newName })}
        onCancel={() => {
          setRenameOpen(false);
          setRenameDoc(null);
        }}
        confirmLoading={renameMutation.isPending}
      >
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
      </Modal>

      {shareDoc && (
        <ShareModal
          open={shareOpen}
          document={shareDoc}
          onClose={() => {
            setShareOpen(false);
            setShareDoc(null);
          }}
        />
      )}

      {versionDoc && (
        <VersionModal
          open={versionOpen}
          document={versionDoc}
          onClose={() => {
            setVersionOpen(false);
            setVersionDoc(null);
          }}
        />
      )}
    </div>
  );
};

export default FileExplorer;
