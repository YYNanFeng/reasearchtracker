import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { readMarkdown, readMarkdownSafe, writeMarkdown, appendToFile, fileExists } from '../../src/storage/markdown.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-md-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('writeMarkdown + readMarkdown', () => {
  it('writes and reads back frontmatter data', () => {
    const filePath = path.join(tmpDir, 'test.md');
    const data = { id: 'idea-test', type: 'idea', status: 'exploring', created: '2026-05-23' };
    writeMarkdown(filePath, data, '## Hello World');

    const result = readMarkdown(filePath);
    expect(result.data.id).toBe('idea-test');
    expect(result.data.type).toBe('idea');
    expect(result.data.status).toBe('exploring');
    expect(result.content).toContain('Hello World');
  });

  it('writes without body and reads back', () => {
    const filePath = path.join(tmpDir, 'test.md');
    const data = { id: 'test', count: 42 };
    writeMarkdown(filePath, data);

    const result = readMarkdown(filePath);
    expect(result.data.id).toBe('test');
    expect(result.data.count).toBe(42);
  });

  it('creates parent directories automatically', () => {
    const filePath = path.join(tmpDir, 'nested', 'dir', 'test.md');
    writeMarkdown(filePath, { id: 'nested' });
    expect(fs.existsSync(filePath)).toBe(true);
  });
});

describe('readMarkdownSafe', () => {
  it('returns null for non-existent file', () => {
    const result = readMarkdownSafe(path.join(tmpDir, 'nope.md'));
    expect(result).toBeNull();
  });

  it('returns parsed data for existing file', () => {
    const filePath = path.join(tmpDir, 'exists.md');
    writeMarkdown(filePath, { id: 'exists' });
    const result = readMarkdownSafe(filePath);
    expect(result).not.toBeNull();
    expect(result!.data.id).toBe('exists');
  });
});

describe('appendToFile', () => {
  it('appends content to existing file', () => {
    const filePath = path.join(tmpDir, 'log.md');
    writeMarkdown(filePath, { type: 'log', date: '2026-05-23' });
    appendToFile(filePath, '\n## 10:30 — Test entry\n');

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('Test entry');
  });

  it('creates file if it does not exist', () => {
    const filePath = path.join(tmpDir, 'new.md');
    appendToFile(filePath, 'Hello');
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toContain('Hello');
  });
});

describe('fileExists', () => {
  it('returns true for existing file', () => {
    const filePath = path.join(tmpDir, 'exists.md');
    writeMarkdown(filePath, { id: 'test' });
    expect(fileExists(filePath)).toBe(true);
  });

  it('returns false for non-existent file', () => {
    expect(fileExists(path.join(tmpDir, 'nope.md'))).toBe(false);
  });
});
