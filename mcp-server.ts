import readline from 'readline';
import { createFileWardrobeStore } from './src/mcp/fileStore';
import { handleMcpJsonRpcRequest, JsonRpcRequest } from './src/mcp/mcpHandler';

/**
 * Standalone STDIO Model Context Protocol (MCP) Server for ATELIER BIOMETRIC.
 * Usage in Claude Desktop / Cursor / Home-Setup:
 *   npx tsx mcp-server.ts
 * Or inside Docker:
 *   docker exec -i atelier-biometric npx tsx mcp-server.ts
 */
const store = createFileWardrobeStore();

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const parsed = JSON.parse(trimmed) as JsonRpcRequest;
    const response = await handleMcpJsonRpcRequest(parsed, store);
    if (response !== null) {
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  } catch (err) {
    const errRes = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: `JSON Parse Error: ${(err as Error).message}`,
      },
    };
    process.stdout.write(JSON.stringify(errRes) + '\n');
  }
});
