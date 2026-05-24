import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export function createTransport(): StdioServerTransport {
  return new StdioServerTransport();
}

export { StdioServerTransport };
