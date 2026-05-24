import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';
import { readMarkdownSafe } from './markdown.js';
import type { BaseNode, NodeMap, TypeIndex } from '../types.js';

export interface ScanResult {
  nodes: NodeMap;
  types: TypeIndex;
}

export async function scanDirectory(rootDir: string): Promise<ScanResult> {
  const researchDir = path.join(rootDir, '.research');
  const nodes: NodeMap = new Map();
  const types: TypeIndex = new Map();

  if (!fs.existsSync(researchDir)) {
    return { nodes, types };
  }

  const pattern = path.join(researchDir, '**', '*.md').replace(/\\/g, '/');
  const files = await glob(pattern, {
    cwd: researchDir,
    absolute: true,
    ignore: ['**/node_modules/**'],
  });

  for (const filePath of files) {
    try {
      const mf = readMarkdownSafe(filePath);
      if (!mf || !mf.data) continue;

      let nodeId = mf.data.id as string | undefined;
      let nodeType = mf.data.type as string | undefined;

      if (!nodeId && mf.data.key) {
        nodeId = mf.data.key as string;
        nodeType = 'reference';
        mf.data.id = nodeId;
        mf.data.type = 'reference';
      }

      if (!nodeId) continue;

      const node = mf.data as unknown as BaseNode;
      nodes.set(node.id, node);

      const type = node.type || 'unknown';
      if (!types.has(type)) {
        types.set(type, new Set());
      }
      types.get(type)!.add(node.id);
    } catch {
      continue;
    }
  }

  return { nodes, types };
}

export function getRelativePath(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath);
}

export function findIdeaDir(rootDir: string, ideaSlug: string): string {
  return path.join(rootDir, '.research', 'ideas', ideaSlug);
}

export function findExperimentDir(
  rootDir: string,
  ideaSlug: string,
  expDirName: string
): string {
  return path.join(
    rootDir,
    '.research',
    'ideas',
    ideaSlug,
    'experiments',
    expDirName
  );
}

export async function getNextExperimentSeq(rootDir: string): Promise<number> {
  const researchDir = path.join(rootDir, '.research');
  if (!fs.existsSync(researchDir)) return 1;

  const pattern = path.join(researchDir, 'ideas', '**', 'experiments', 'exp-*').replace(/\\/g, '/');
  const dirs = await glob(pattern, {
    cwd: researchDir,
    absolute: false,
  });

  let maxSeq = 0;
  for (const dir of dirs) {
    const match = dir.match(/exp-(\d+)/);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }

  return maxSeq + 1;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function ideaIdToSlug(id: string): string {
  return id.replace(/^idea-/, '');
}

export function getNextExperimentSeqForIdea(rootDir: string, ideaSlug: string): number {
  const expsDir = path.join(rootDir, '.research', 'ideas', ideaSlug, 'experiments');
  if (!fs.existsSync(expsDir)) return 1;

  const dirs = fs.readdirSync(expsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  let maxSeq = 0;
  for (const dirName of dirs) {
    const match = dirName.match(/^exp-(\d+)/);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  return maxSeq + 1;
}

export function expIdToSlug(id: string): string {
  const match = id.match(/^exp-\d+-(.+)$/);
  return match ? match[1] : id;
}

export function findIdeaSlugByExpDir(rootDir: string, expDir: string): string | null {
  const researchDir = path.join(rootDir, '.research', 'ideas');
  const relative = path.relative(researchDir, expDir);
  const parts = relative.split(path.sep);
  return parts[0] || null;
}
