import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createFileWardrobeStore } from './src/mcp/fileStore';
import {
  handleMcpJsonRpcRequest,
  JsonRpcRequest,
  MCP_TOOLS_MANIFEST,
} from './src/mcp/mcpHandler';

const PORT = Number(process.env.PORT) || 3000;
const BASIC_AUTH_USER = (process.env.BASIC_AUTH_USER || '').trim();
const BASIC_AUTH_PASS = (process.env.BASIC_AUTH_PASS || '').trim();
const store = createFileWardrobeStore();

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '15mb' }));

  // Healthcheck endpoint for Docker / Coolify / Railway / Reverse Proxies (unauthenticated)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'thread-graph' });
  });

  // Optional HTTP Basic Auth when BASIC_AUTH_USER and BASIC_AUTH_PASS are set
  if (BASIC_AUTH_USER && BASIC_AUTH_PASS) {
    app.use((req, res, next) => {
      if (req.method === 'OPTIONS' || req.path === '/api/health') {
        next();
        return;
      }
      const authHeader = req.headers.authorization || '';
      if (authHeader.startsWith('Basic ')) {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
        const sepIdx = decoded.indexOf(':');
        if (sepIdx !== -1) {
          const user = decoded.slice(0, sepIdx);
          const pass = decoded.slice(sepIdx + 1);
          if (user === BASIC_AUTH_USER && pass === BASIC_AUTH_PASS) {
            next();
            return;
          }
        }
      }
      res.setHeader('WWW-Authenticate', 'Basic realm="Atelier Biometric Wardrobe"');
      res.status(401).send('Authentication required');
    });
  }

  // Allow local CORS for MCP HTTP clients (OpenWebUI, Cursor, local scripts)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // 1. REST API for syncing Wardrobe state between Browser UI & Server/MCP Store
  app.get('/api/wardrobe', async (_req, res) => {
    try {
      const payload = await store.getFullPayload();
      res.json({
        ...payload,
        mcpEndpoint: '/mcp',
        toolCount: MCP_TOOLS_MANIFEST.length,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/wardrobe', async (req, res) => {
    try {
      const current = await store.getState();
      const nextProfile = req.body?.profile || current.profile;
      const nextGarments = Array.isArray(req.body?.garments)
        ? req.body.garments
        : current.garments;
      const nextWornHistory = Array.isArray(req.body?.wornHistory)
        ? req.body.wornHistory
        : current.wornHistory || [];

      await store.setState({
        profile: nextProfile,
        garments: nextGarments,
        wornHistory: nextWornHistory,
      });
      const updated = await store.getFullPayload();
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 2. Model Context Protocol (MCP) Streamable HTTP Endpoint (/mcp)
  app.get('/mcp', async (_req, res) => {
    const payload = await store.getFullPayload();
    res.json({
      protocol: 'Model Context Protocol (MCP)',
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: 'atelier-biometric-wardrobe-mcp',
        version: '1.0.0',
      },
      transport: ['streamable-http (POST /mcp)', 'stdio (npx tsx mcp-server.ts)'],
      status: 'online',
      wardrobeStats: {
        garmentCount: payload.garments.length,
        updatedAt: payload.updatedAt,
      },
      tools: MCP_TOOLS_MANIFEST.map((t) => ({
        name: t.name,
        description: t.description,
      })),
    });
  });

  app.post('/mcp', async (req, res) => {
    try {
      const body = req.body;
      if (Array.isArray(body)) {
        const responses = [];
        for (const item of body) {
          const r = await handleMcpJsonRpcRequest(item as JsonRpcRequest, store);
          if (r) responses.push(r);
        }
        res.json(responses);
        return;
      }

      const rpcResponse = await handleMcpJsonRpcRequest(body as JsonRpcRequest, store);
      if (rpcResponse === null) {
        res.status(202).end();
        return;
      }
      res.json(rpcResponse);
    } catch (err) {
      res.status(400).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: (err as Error).message || 'Ungültige JSON-RPC Anfrage',
        },
      });
    }
  });

  // 3. Vite Dev Middleware or Production Static Files
  const http = await import('http');
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    app.get('/@vite-plugin-pwa/pwa-entry-point-loaded', (_req, res) => {
      res.type('application/javascript').send('export default function registerDevSW() {}\n');
    });
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
        ws: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
        watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/data/**'] },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[ATELIER BIOMETRIC] Web UI + HTTP MCP Server running on http://0.0.0.0:${PORT} (MCP: http://localhost:${PORT}/mcp)`
    );
  });
}

startServer();
