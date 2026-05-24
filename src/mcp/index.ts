import process from 'node:process';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { registerTools } from './tools.js';
import { createTransport } from './transport.js';

export async function startMcpServer(rootDir: string): Promise<Server> {
  const server = new Server(
    { name: 'researchtracker', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  registerTools(server, rootDir);

  const transport = createTransport();
  await server.connect(transport);

  process.stderr.write(`[researchtracker] MCP server started for: ${rootDir}\n`);

  return server;
}

export { Server } from '@modelcontextprotocol/sdk/server/index.js';
export { createTransport } from './transport.js';
export { registerTools } from './tools.js';
