import * as YAML from 'yaml';
import { Scalar } from 'yaml';

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  content: string;
}

export function parseFrontmatter(fileContent: string): ParsedFrontmatter {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: fileContent };
  }
  const yamlStr = match[1];
  const body = match[2] || '';
  const data = YAML.parse(yamlStr, { schema: 'failsafe' }) as Record<string, unknown>;
  return { data, content: body };
}

/** 匹配 YAML 会自动解析为 Date 的日期格式，如 2026-05-23 */
const DATE_LIKE_RE = /^\d{4}-\d{2}-\d{2}$/;

function quoteStrings(item: unknown): unknown {
  if (item === null || item === undefined) return item;
  if (typeof item === 'string') {
    const scalar = new YAML.Scalar(item);
    // 强制给日期格式的字符串加引号，避免 YAML 解析为 Date 对象
    if (DATE_LIKE_RE.test(item)) {
      scalar.type = Scalar.QUOTE_DOUBLE;
    }
    return scalar;
  }
  if (typeof item === 'number' || typeof item === 'boolean') {
    return item;
  }
  if (Array.isArray(item)) {
    return item.map(quoteStrings);
  }
  if (typeof item === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
      result[key] = quoteStrings(value);
    }
    return result;
  }
  return item;
}

export function generateFrontmatter(data: Record<string, unknown>): string {
  const quoted = quoteStrings(data) as Record<string, unknown>;
  const yamlStr = YAML.stringify(quoted, { lineWidth: 0, singleQuote: false });
  return `---\n${yamlStr}---\n`;
}

export function generateMarkdown(data: Record<string, unknown>, body?: string): string {
  const fm = generateFrontmatter(data);
  if (body && body.trim()) {
    return `${fm}\n${body.trim()}\n`;
  }
  return `${fm}\n`;
}

export function updateFrontmatter(
  fileContent: string,
  updates: Record<string, unknown>
): string {
  const parsed = parseFrontmatter(fileContent);
  const merged = { ...parsed.data, ...updates };
  return generateMarkdown(merged, parsed.content);
}
