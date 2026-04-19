import { WebSocket, WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { v4 as uuidv4 } from 'uuid';
import { getPrisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { getRedis } from '../config/redis.js';
import type { Server } from 'http';

interface CollaborationSession {
  documentId: string;
  yDoc: Y.Doc;
  clients: Map<string, WebSocket>;
  lastActivity: Date;
}

interface ClientInfo {
  id: string;
  userId: string;
  userName: string;
  color: string;
  cursor?: {
    index: number;
    length: number;
  };
}

export class CollaborationService {
  private static wss: WebSocketServer | null = null;
  private static sessions: Map<string, CollaborationSession> = new Map();
  private static clientInfos: Map<WebSocket, ClientInfo> = new Map();
  private static readonly COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
  ];

  static initialize(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws/collaboration' });

    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const documentId = url.searchParams.get('documentId');
      const userId = url.searchParams.get('userId');
      const userName = url.searchParams.get('userName') || 'Anonymous';

      if (!documentId || !userId) {
        ws.close(4000, 'Missing documentId or userId');
        return;
      }

      this.handleConnection(ws, documentId, userId, userName);
    });

    setInterval(() => this.cleanupInactiveSessions(), 60000);

    logger.info('Collaboration WebSocket server initialized');
  }

  private static handleConnection(
    ws: WebSocket,
    documentId: string,
    userId: string,
    userName: string
  ): void {
    const clientId = uuidv4();
    const clientInfo: ClientInfo = {
      id: clientId,
      userId,
      userName,
      color: this.COLORS[Math.floor(Math.random() * this.COLORS.length)],
    };

    this.clientInfos.set(ws, clientInfo);

    let session = this.sessions.get(documentId);
    if (!session) {
      session = {
        documentId,
        yDoc: new Y.Doc(),
        clients: new Map(),
        lastActivity: new Date(),
      };
      this.sessions.set(documentId, session);
      this.loadDocumentContent(documentId, session.yDoc);
    }

    session.clients.set(clientId, ws);
    session.lastActivity = new Date();

    const stateUpdate = Y.encodeStateAsUpdate(session.yDoc);
    ws.send(JSON.stringify({
      type: 'sync',
      data: Array.from(stateUpdate),
    }));

    this.broadcastPresence(session);

    ws.on('message', (message) => {
      this.handleMessage(ws, documentId, message);
    });

    ws.on('close', () => {
      this.handleDisconnect(ws, documentId, clientId);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      this.handleDisconnect(ws, documentId, clientId);
    });

    logger.info(`Client ${clientId} connected to document ${documentId}`);
  }

  private static handleMessage(
    ws: WebSocket,
    documentId: string,
    message: Buffer | ArrayBuffer | Buffer[]
  ): void {
    const session = this.sessions.get(documentId);
    if (!session) return;

    try {
      const data = JSON.parse(message.toString());
      session.lastActivity = new Date();

      switch (data.type) {
        case 'update':
          const update = new Uint8Array(data.data);
          Y.applyUpdate(session.yDoc, update);

          session.clients.forEach((client, id) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'update',
                data: Array.from(update),
              }));
            }
          });

          this.scheduleAutoSave(documentId);
          break;

        case 'cursor':
          const clientInfo = this.clientInfos.get(ws);
          if (clientInfo) {
            clientInfo.cursor = data.cursor;
            this.broadcastCursors(session, ws);
          }
          break;

        case 'awareness':
          session.clients.forEach((client, id) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'awareness',
                clientId: this.clientInfos.get(ws)?.id,
                data: data.data,
              }));
            }
          });
          break;
      }
    } catch (error) {
      logger.error('Error handling collaboration message:', error);
    }
  }

  private static handleDisconnect(
    ws: WebSocket,
    documentId: string,
    clientId: string
  ): void {
    const session = this.sessions.get(documentId);
    if (session) {
      session.clients.delete(clientId);

      if (session.clients.size === 0) {
        this.saveDocument(documentId, session.yDoc);
        setTimeout(() => {
          const currentSession = this.sessions.get(documentId);
          if (currentSession && currentSession.clients.size === 0) {
            this.sessions.delete(documentId);
            logger.info(`Session for document ${documentId} cleaned up`);
          }
        }, 30000);
      } else {
        this.broadcastPresence(session);
      }
    }

    this.clientInfos.delete(ws);
    logger.info(`Client ${clientId} disconnected from document ${documentId}`);
  }

  private static broadcastPresence(session: CollaborationSession): void {
    const users: ClientInfo[] = [];
    session.clients.forEach((client) => {
      const info = this.clientInfos.get(client);
      if (info) {
        users.push(info);
      }
    });

    const message = JSON.stringify({
      type: 'presence',
      users,
    });

    session.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private static broadcastCursors(
    session: CollaborationSession,
    excludeWs?: WebSocket
  ): void {
    const cursors: Array<ClientInfo & { cursor?: { index: number; length: number } }> = [];

    session.clients.forEach((client) => {
      const info = this.clientInfos.get(client);
      if (info && info.cursor) {
        cursors.push(info);
      }
    });

    const message = JSON.stringify({
      type: 'cursors',
      cursors,
    });

    session.clients.forEach((client) => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private static async loadDocumentContent(
    documentId: string,
    yDoc: Y.Doc
  ): Promise<void> {
    try {
      const redis = getRedis();
      const cached = await redis.get(`collab:${documentId}`);

      if (cached) {
        const update = new Uint8Array(JSON.parse(cached));
        Y.applyUpdate(yDoc, update);
        return;
      }
    } catch (error) {
      logger.error(`Error loading document ${documentId}:`, error);
    }
  }

  private static saveTimeouts: Map<string, NodeJS.Timeout> = new Map();

  private static scheduleAutoSave(documentId: string): void {
    const existing = this.saveTimeouts.get(documentId);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(() => {
      const session = this.sessions.get(documentId);
      if (session) {
        this.saveDocument(documentId, session.yDoc);
      }
      this.saveTimeouts.delete(documentId);
    }, 5000);

    this.saveTimeouts.set(documentId, timeout);
  }

  private static async saveDocument(
    documentId: string,
    yDoc: Y.Doc
  ): Promise<void> {
    try {
      const update = Y.encodeStateAsUpdate(yDoc);
      const redis = getRedis();
      await redis.setex(
        `collab:${documentId}`,
        86400,
        JSON.stringify(Array.from(update))
      );

      logger.debug(`Document ${documentId} saved to cache`);
    } catch (error) {
      logger.error(`Error saving document ${documentId}:`, error);
    }
  }

  private static cleanupInactiveSessions(): void {
    const now = new Date();
    const maxInactivity = 30 * 60 * 1000;

    this.sessions.forEach((session, documentId) => {
      if (
        session.clients.size === 0 &&
        now.getTime() - session.lastActivity.getTime() > maxInactivity
      ) {
        this.sessions.delete(documentId);
        logger.info(`Inactive session ${documentId} cleaned up`);
      }
    });
  }

  static getActiveUsers(documentId: string): ClientInfo[] {
    const session = this.sessions.get(documentId);
    if (!session) return [];

    const users: ClientInfo[] = [];
    session.clients.forEach((client) => {
      const info = this.clientInfos.get(client);
      if (info) {
        users.push(info);
      }
    });

    return users;
  }

  static async persistDocument(documentId: string, userId: string): Promise<void> {
    const session = this.sessions.get(documentId);
    if (!session) return;

    const yText = session.yDoc.getText('content');
    const content = yText.toString();

  }

  static shutdown(): void {
    this.sessions.forEach((session, documentId) => {
      this.saveDocument(documentId, session.yDoc);
      session.clients.forEach((client) => {
        client.close(1001, 'Server shutting down');
      });
    });

    if (this.wss) {
      this.wss.close();
    }

    logger.info('Collaboration service shut down');
  }
}
