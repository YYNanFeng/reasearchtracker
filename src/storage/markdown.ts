import * as fs from 'node:fs';
import * as path from 'node:path';
import matter from 'gray-matter';
import * as YAML from 'yaml';
import { generateMarkdown, updateFrontmatter as updateFm } from './frontmatter.js';
import type { MarkdownFile } from '../types.js';

function deepConvertDates(obj: unknown): unknown {
  if (obj instanceof Date) {
    return obj.toISOString().split('T')[0];
  }
  if (Array.isArray(obj)) {
    return obj.map(deepConvertDates);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepConvertDates(value);
    }
    return result;
  }
  return obj;
}

export function readMarkdown(filePath: string): MarkdownFile {
  const absolute = path.resolve(filePath);
  const raw = fs.readFileSync(absolute, 'utf-8');
  const parsed = matter(raw, {
    engines: {
      yaml: (s: string) => YAML.parse(s, { schema: 'core' }) as Record<string, unknown>,
    },
  });
  const data = deepConvertDates(parsed.data) as Record<string, unknown>;
  return {
    data,
    content: parsed.content,
    path: absolute,
  };
}

export function readMarkdownSafe(filePath: string): MarkdownFile | null {
  try {
    return readMarkdown(filePath);
  } catch {
    return null;
  }
}

export function writeMarkdown(
  filePath: string,
  data: Record<string, unknown>,
  content?: string
): void {
  const absolute = path.resolve(filePath);
  const dir = path.dirname(absolute);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const output = generateMarkdown(data, content);
  fs.writeFileSync(absolute, output, 'utf-8');
}

export function updateMarkdownFile(
  filePath: string,
  updates: Record<string, unknown>,
  body?: string
): void {
  const absolute = path.resolve(filePath);
  let raw: string;
  try {
    raw = fs.readFileSync(absolute, 'utf-8');
  } catch {
    raw = '';
  }
  const updated = updateFm(raw, updates);
  const result = body !== undefined ? updated : updated;
  const dir = path.dirname(absolute);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(absolute, result, 'utf-8');
}

export function appendToFile(filePath: string, text: string): void {
  const absolute = path.resolve(filePath);
  const dir = path.dirname(absolute);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.appendFileSync(absolute, text, 'utf-8');
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(path.resolve(filePath));
}

export function ensureDir(dirPath: string): void {
  const absolute = path.resolve(dirPath);
  if (!fs.existsSync(absolute)) {
    fs.mkdirSync(absolute, { recursive: true });
  }
}
