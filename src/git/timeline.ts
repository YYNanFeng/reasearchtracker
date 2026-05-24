import { execSync } from 'node:child_process';
import type { TimelineEntry } from '../types.js';
import { isGitRepo } from './commits.js';

export async function getGitTimeline(
  rootDir: string,
  from?: string,
  to?: string
): Promise<TimelineEntry[]> {
  if (!isGitRepo(rootDir)) return [];

  try {
    let gitLogCmd = 'git log --format="%H|%ai|%s"';
    if (from || to) {
      const range = [];
      if (from) range.push(`--since="${from}"`);
      if (to) range.push(`--until="${to}"`);
      gitLogCmd += ` ${range.join(' ')}`;
    }

    const output = execSync(gitLogCmd, {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!output) return [];

    return output.split('\n').map((line) => {
      const [hash, date, ...msgParts] = line.split('|');
      return {
        date: date?.trim() || '',
        type: 'git' as const,
        content: `${msgParts.join('|').trim()} (${hash?.substring(0, 7)})`,
      };
    });
  } catch {
    return [];
  }
}
