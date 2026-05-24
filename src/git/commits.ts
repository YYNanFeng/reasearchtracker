import { execSync } from 'node:child_process';

export function getHeadCommit(rootDir: string): string | null {
  try {
    const hash = execSync('git rev-parse HEAD', {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return hash || null;
  } catch {
    return null;
  }
}

export function isGitRepo(rootDir: string): boolean {
  try {
    execSync('git rev-parse --git-dir', {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}
