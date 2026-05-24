import type { BaseNode, NodeMap, TypeIndex, Idea, Experiment } from '../types.js';
import { getNodesByType, getExperimentsForIdea } from './nodes.js';

export function findByStatus(
  nodes: NodeMap,
  types: TypeIndex,
  type: string,
  status: string
): BaseNode[] {
  return getNodesByType(nodes, types, type).filter(
    (n) => (n as unknown as Record<string, unknown>).status === status
  );
}

export function findByTag(
  nodes: NodeMap,
  types: TypeIndex,
  type: string,
  tag: string
): BaseNode[] {
  return getNodesByType(nodes, types, type).filter(
    (n) => {
      const rec = n as unknown as Record<string, unknown>;
      return rec.tags && Array.isArray(rec.tags) && (rec.tags as string[]).includes(tag);
    }
  );
}

export function findLinked(
  nodes: NodeMap,
  types: TypeIndex,
  id: string,
  field: string
): BaseNode[] {
  const results: BaseNode[] = [];
  for (const [, node] of nodes) {
    const record = node as unknown as Record<string, unknown>;
    if (record[field] === id) {
      results.push(node);
    }
  }
  return results;
}

export function getIdeaTree(
  nodes: NodeMap,
  types: TypeIndex
): Array<{ idea: Idea; experiments: Experiment[] }> {
  const ideas = getNodesByType(nodes, types, 'idea') as unknown as Idea[];
  return ideas
    .sort((a, b) => a.created.localeCompare(b.created))
    .map((idea) => ({
      idea,
      experiments: getExperimentsForIdea(nodes, types, idea.id).sort(
        (a, b) => {
          const seqA = parseInt((a.id.match(/exp-(\d+)/) || [])[1] || '0', 10);
          const seqB = parseInt((b.id.match(/exp-(\d+)/) || [])[1] || '0', 10);
          return seqA - seqB;
        }
      ),
    }));
}
