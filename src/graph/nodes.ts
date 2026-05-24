import type { BaseNode, NodeMap, TypeIndex, Idea, Experiment, Result, Reference } from '../types.js';

export function getNode(nodes: NodeMap, id: string): BaseNode | undefined {
  return nodes.get(id);
}

export function getNodesByType(nodes: NodeMap, types: TypeIndex, type: string): BaseNode[] {
  const ids = types.get(type);
  if (!ids) return [];
  const result: BaseNode[] = [];
  for (const id of ids) {
    const node = nodes.get(id);
    if (node) result.push(node);
  }
  return result;
}

export function filterNodes<T extends BaseNode>(
  nodes: NodeMap,
  types: TypeIndex,
  type: string,
  predicate: (node: BaseNode) => boolean
): T[] {
  const all = getNodesByType(nodes, types, type);
  return all.filter(predicate) as T[];
}

export function getIdea(nodes: NodeMap, id: string): Idea | null {
  const node = nodes.get(id);
  if (!node || node.type !== 'idea') return null;
  return node as unknown as Idea;
}

export function getExperiment(nodes: NodeMap, id: string): Experiment | null {
  const node = nodes.get(id);
  if (!node || node.type !== 'experiment') return null;
  return node as unknown as Experiment;
}

export function getResult(nodes: NodeMap, id: string): Result | null {
  const node = nodes.get(id);
  if (!node || node.type !== 'result') return null;
  return node as unknown as Result;
}

export function getReference(nodes: NodeMap, key: string): Reference | null {
  const node = nodes.get(key);
  if (!node) return null;
  return node as unknown as Reference;
}

export function getExperimentsForIdea(
  nodes: NodeMap,
  types: TypeIndex,
  ideaId: string
): Experiment[] {
  return filterNodes<Experiment>(
    nodes,
    types,
    'experiment',
    (node) => (node as unknown as Experiment).idea === ideaId
  );
}

export function getResultForExperiment(
  nodes: NodeMap,
  types: TypeIndex,
  expId: string
): Result | null {
  const results = filterNodes<Result>(
    nodes,
    types,
    'result',
    (node) => (node as unknown as Result).experiment === expId
  );
  return results.length > 0 ? results[0] : null;
}

export function getIdeasByStatus(
  nodes: NodeMap,
  types: TypeIndex,
  status: string
): Idea[] {
  return filterNodes<Idea>(
    nodes,
    types,
    'idea',
    (node) => (node as unknown as Idea).status === status
  );
}

export function getExperimentsByStatus(
  nodes: NodeMap,
  types: TypeIndex,
  status: string
): Experiment[] {
  return filterNodes<Experiment>(
    nodes,
    types,
    'experiment',
    (node) => (node as unknown as Experiment).status === status
  );
}
