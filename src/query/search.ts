import type { NodeMap, TypeIndex, SearchResult } from '../types.js';
import { readMarkdownSafe } from '../storage/markdown.js';

export function searchNodes(
  nodes: NodeMap,
  keyword: string,
  rootDir?: string
): SearchResult[] {
  const lowerKeyword = keyword.toLowerCase();
  const results: SearchResult[] = [];

  for (const [id, node] of nodes) {
    const dataStr = JSON.stringify(node).toLowerCase();
    if (dataStr.includes(lowerKeyword)) {
      const matchField = findMatchingField(node as unknown as Record<string, unknown>, lowerKeyword);
      results.push({
        id,
        type: node.type,
        snippet: matchField,
      });
      continue;
    }

    if (rootDir) {
      const filePath = getNodeFilePath(node as unknown as Record<string, unknown>, rootDir);
      if (filePath) {
        const mf = readMarkdownSafe(filePath);
        if (mf && mf.content.toLowerCase().includes(lowerKeyword)) {
          const idx = mf.content.toLowerCase().indexOf(lowerKeyword);
          const start = Math.max(0, idx - 30);
          const end = Math.min(mf.content.length, idx + lowerKeyword.length + 30);
          const snippet = mf.content.slice(start, end);
          results.push({
            id,
            type: node.type,
            snippet: `...${snippet}...`,
          });
        }
      }
    }
  }

  return results;
}

function findMatchingField(
  node: Record<string, unknown>,
  keyword: string
): string {
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'string' && value.toLowerCase().includes(keyword)) {
      return `${key}: ${value}`;
    }
  }
  return JSON.stringify(node).slice(0, 100);
}

function getNodeFilePath(
  node: Record<string, unknown>,
  rootDir: string
): string | null {
  const fs = require('node:fs');
  const path = require('node:path');

  if (node.type === 'idea') {
    const slug = (node.id as string).replace(/^idea-/, '');
    const p = path.join(rootDir, '.research', 'ideas', slug, 'README.md');
    return fs.existsSync(p) ? p : null;
  }
  if (node.type === 'experiment') {
    const expId = node.id as string;
    const ideaSlug = (node.idea as string).replace(/^idea-/, '');
    const p = path.join(
      rootDir,
      '.research',
      'ideas',
      ideaSlug,
      'experiments',
      expId,
      'README.md'
    );
    return fs.existsSync(p) ? p : null;
  }
  if (node.type === 'result') {
    const expId = node.experiment as string;
    const ideaSlug = (expId.replace(/^exp-\d+-/, ''));
    const p = path.join(
      rootDir,
      '.research',
      'ideas',
      ideaSlug,
      'experiments',
      expId,
      'result.md'
    );
    return fs.existsSync(p) ? p : null;
  }
  return null;
}
