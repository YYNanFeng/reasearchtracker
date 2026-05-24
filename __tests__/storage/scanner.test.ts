import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { scanDirectory, slugify, getNextExperimentSeq } from '../../src/storage/scanner.js';
import { writeMarkdown } from '../../src/storage/markdown.js';

let tmpDir: string;
let researchDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-scan-'));
  researchDir = path.join(tmpDir, '.research');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('scanDirectory', () => {
  it('returns empty maps for non-existent .research/', async () => {
    const result = await scanDirectory(tmpDir);
    expect(result.nodes.size).toBe(0);
    expect(result.types.size).toBe(0);
  });

  it('scans and indexes ideas, experiments, and results', async () => {
    fs.mkdirSync(path.join(researchDir, 'ideas', 'test-idea', 'experiments', 'exp-001-baseline'), { recursive: true });
    fs.mkdirSync(path.join(researchDir, 'refs'), { recursive: true });

    writeMarkdown(path.join(researchDir, 'ideas', 'test-idea', 'README.md'), {
      id: 'idea-test-idea',
      type: 'idea',
      status: 'exploring',
      claim: 'test claim',
      created: '2026-05-23',
    });

    writeMarkdown(path.join(researchDir, 'ideas', 'test-idea', 'experiments', 'exp-001-baseline', 'README.md'), {
      id: 'exp-001-baseline',
      type: 'experiment',
      status: 'planned',
      idea: 'idea-test-idea',
      created: '2026-05-23',
    });

    writeMarkdown(path.join(researchDir, 'refs', 'lin2017.md'), {
      key: 'lin2017',
      title: 'FPN',
      authors: 'Lin',
      year: 2017,
    });

    const result = await scanDirectory(tmpDir);
    expect(result.nodes.size).toBe(3);
    expect(result.nodes.has('idea-test-idea')).toBe(true);
    expect(result.nodes.has('exp-001-baseline')).toBe(true);
    expect(result.nodes.has('lin2017')).toBe(true);
    expect(result.types.get('idea')!.size).toBe(1);
    expect(result.types.get('experiment')!.size).toBe(1);
    expect(result.types.get('reference')!.size).toBe(1);
  });
});

describe('slugify', () => {
  it('converts spaces to hyphens', () => {
    expect(slugify('hello world')).toBe('hello-world');
  });

  it('lowercases input', () => {
    expect(slugify('FPN CBAM')).toBe('fpn-cbam');
  });

  it('removes special characters', () => {
    expect(slugify('test #1! (v2)')).toBe('test-1-v2');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('a   b')).toBe('a-b');
  });

  it('handles unicode characters', () => {
    const result = slugify('FPN + CBAM 注意力');
    expect(result).toContain('fpn');
    expect(result).toContain('cbam');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getNextExperimentSeq', () => {
  it('returns 1 when no experiments exist', async () => {
    fs.mkdirSync(path.join(researchDir, 'ideas'), { recursive: true });
    const seq = await getNextExperimentSeq(tmpDir);
    expect(seq).toBe(1);
  });

  it('returns max seq + 1 for existing experiments', async () => {
    fs.mkdirSync(path.join(researchDir, 'ideas', 'idea-a', 'experiments', 'exp-001-test'), { recursive: true });
    fs.mkdirSync(path.join(researchDir, 'ideas', 'idea-b', 'experiments', 'exp-003-other'), { recursive: true });

    const seq = await getNextExperimentSeq(tmpDir);
    expect(seq).toBe(4);
  });
});
