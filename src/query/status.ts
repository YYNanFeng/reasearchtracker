import * as path from 'node:path';
import type { NodeMap, TypeIndex, ProjectInfo } from '../types.js';
import { getIdeaTree } from '../graph/query.js';
import { getResultForExperiment } from '../graph/nodes.js';
import { readMarkdownSafe } from '../storage/markdown.js';

const STATUS_ICONS: Record<string, string> = {
  exploring: '🔍',
  validated: '✅',
  refuted: '❌',
  parked: '⏸️',
  abandoned: '🚫',
  planned: '📋',
  running: '🔄',
  completed: '✅',
  failed: '❌',
  cancelled: '🚫',
  active: '🟢',
  completed_project: '🏁',
  archived: '📦',
};

const STATUS_LABELS: Record<string, string> = {
  exploring: '探索中',
  validated: '已验证',
  refuted: '已否定',
  parked: '已搁置',
  abandoned: '已放弃',
  planned: '计划中',
  running: '运行中',
  completed: '完成',
  failed: '失败',
  cancelled: '已取消',
  active: '活跃',
  completed_project: '已完成',
  archived: '已归档',
};

export async function getStatusTree(
  nodes: NodeMap,
  types: TypeIndex,
  rootDir: string
): Promise<string> {
  const projectInfo = await loadProjectInfo(rootDir);
  const tree = getIdeaTree(nodes, types);

  const lines: string[] = [];

  if (projectInfo) {
    const statusLabel = STATUS_LABELS[projectInfo.status] || projectInfo.status;
    lines.push(`📋 项目: ${projectInfo.name} (${statusLabel})`);
  }

  tree.forEach((item, idx) => {
    const isLast = idx === tree.length - 1;
    const prefix = isLast ? '└── ' : '├── ';
    const ideaStatus = STATUS_LABELS[item.idea.status] || item.idea.status;
    lines.push(
      `${prefix}💡 思路: ${extractTitle(item.idea.id)} [${ideaStatus}]`
    );

    item.experiments.forEach((exp, expIdx) => {
      const isLastExp = expIdx === item.experiments.length - 1;
      const expPrefix = isLast ? '│   ' : '│   ';
      const expConnector = isLastExp ? '└── ' : '├── ';
      const expStatus = STATUS_LABELS[exp.status] || exp.status;
      const expTitle = extractExpTitle(exp.id);
      lines.push(
        `│   ${expConnector}🧪 ${expTitle} [${expStatus}]`
      );
    });
  });

  return lines.join('\n');
}

export async function getStatusJson(
  nodes: NodeMap,
  types: TypeIndex,
  rootDir: string
): Promise<Record<string, unknown>> {
  const projectInfo = await loadProjectInfo(rootDir);
  const tree = getIdeaTree(nodes, types);

  return {
    project: projectInfo,
    ideas: tree.map((item) => ({
      id: item.idea.id,
      status: item.idea.status,
      claim: item.idea.claim,
      experiments: item.experiments.map((exp) => {
        const result = getResultForExperiment(nodes, types, exp.id);
        return {
          id: exp.id,
          status: exp.status,
          result: result
            ? { status: result.status, claim: result.claim }
            : null,
        };
      }),
    })),
  };
}

async function loadProjectInfo(rootDir: string): Promise<ProjectInfo | null> {
  const readmePath = path.join(rootDir, '.research', 'README.md');
  const mf = readMarkdownSafe(readmePath);
  if (!mf) return null;
  return mf.data as unknown as ProjectInfo;
}

function extractTitle(ideaId: string): string {
  const slug = ideaId.replace(/^idea-/, '');
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function extractExpTitle(expId: string): string {
  const match = expId.match(/^exp-(\d+)-(.+)$/);
  if (match) {
    return `${match[1]}: ${match[2]
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')}`;
  }
  return expId;
}
