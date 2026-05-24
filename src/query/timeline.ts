import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';
import { parseFrontmatter } from '../storage/frontmatter.js';
import { getGitTimeline } from '../git/timeline.js';
import type { TimelineEntry, TimelineFilter } from '../types.js';

export async function buildTimeline(
  rootDir: string,
  filter?: TimelineFilter
): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];

  const logEntries = await collectLogEntries(rootDir);
  entries.push(...logEntries);

  const gitEntries = await getGitTimeline(
    rootDir,
    filter?.from,
    filter?.to
  );
  entries.push(...gitEntries);

  entries.sort((a, b) => b.date.localeCompare(a.date));

  if (filter?.from) {
    const from = filter.from;
    return entries.filter((e) => e.date >= from);
  }
  if (filter?.to) {
    const to = filter.to;
    return entries.filter((e) => e.date <= to);
  }

  return entries;
}

async function collectLogEntries(rootDir: string): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];
  const logsDir = path.join(rootDir, '.research', 'logs');

  if (!fs.existsSync(logsDir)) return entries;

  const pattern = path.join(logsDir, '*.md').replace(/\\/g, '/');
  const files = await glob(pattern, { absolute: true });

  for (const file of files) {
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const parsed = parseFrontmatter(raw);
      const date = parsed.data.date as string;
      if (!date) continue;

      const sections = parsed.content.split(/^## /m).slice(1);
      for (const section of sections) {
        const lines = section.split('\n');
        const header = lines[0].trim();
        const content = lines.slice(1).join('\n').trim();
        entries.push({
          date: `${date}T${header.replace(/\s.*$/, '')}`,
          type: 'log',
          content: content || header,
        });
      }
    } catch {
      continue;
    }
  }

  return entries;
}
