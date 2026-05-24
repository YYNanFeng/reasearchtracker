import { describe, it, expect } from 'vitest';
import { parseFrontmatter, generateFrontmatter, generateMarkdown, updateFrontmatter } from '../../src/storage/frontmatter.js';

describe('parseFrontmatter', () => {
  it('parses valid frontmatter with body', () => {
    const content = `---
id: "idea-test"
type: "idea"
status: "exploring"
created: "2026-05-23"
---

## Body content here
`;
    const result = parseFrontmatter(content);
    expect(result.data.id).toBe('idea-test');
    expect(result.data.type).toBe('idea');
    expect(result.data.status).toBe('exploring');
    expect(result.data.created).toBe('2026-05-23');
    expect(result.content.trim()).toContain('Body content here');
  });

  it('returns empty data for content without frontmatter', () => {
    const content = 'Just plain markdown content\n';
    const result = parseFrontmatter(content);
    expect(Object.keys(result.data)).toHaveLength(0);
    expect(result.content).toBe(content);
  });

  it('handles empty body', () => {
    const content = '---\nid: "test"\n---\n';
    const result = parseFrontmatter(content);
    expect(result.data.id).toBe('test');
    expect(result.content.trim()).toBe('');
  });
});

describe('generateFrontmatter', () => {
  it('generates YAML frontmatter with quoted strings', () => {
    const data = { id: 'idea-test', type: 'idea', status: 'exploring' };
    const result = generateFrontmatter(data);
    expect(result).toContain('---');
    expect(result).toContain('id');
    expect(result).toContain('idea-test');
  });

  it('handles numbers without quotes', () => {
    const data = { confidence: 0.85, year: 2026 };
    const result = generateFrontmatter(data);
    expect(result).toContain('0.85');
    expect(result).toContain('2026');
  });

  it('handles arrays', () => {
    const data = { tags: ['a', 'b', 'c'] };
    const result = generateFrontmatter(data);
    expect(result).toContain('a');
    expect(result).toContain('b');
    expect(result).toContain('c');
  });
});

describe('generateMarkdown', () => {
  it('generates markdown with frontmatter and body', () => {
    const data = { id: 'test' };
    const result = generateMarkdown(data, '## Hello');
    expect(result).toContain('---');
    expect(result).toContain('## Hello');
  });

  it('generates markdown without body', () => {
    const data = { id: 'test' };
    const result = generateMarkdown(data);
    expect(result).toContain('---');
    expect(result).toContain('id');
  });
});

describe('updateFrontmatter', () => {
  it('updates existing fields', () => {
    const content = `---
id: "idea-test"
status: "exploring"
created: "2026-05-23"
---

Body here
`;
    const result = updateFrontmatter(content, { status: 'validated' });
    expect(result).toContain('validated');
    expect(result).toContain('Body here');
  });

  it('adds new fields', () => {
    const content = `---
id: "test"
---

Body
`;
    const result = updateFrontmatter(content, { evidence: 'some evidence' });
    expect(result).toContain('some evidence');
    expect(result).toContain('Body');
  });
});
