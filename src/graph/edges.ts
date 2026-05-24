import type { Idea, IdeaRelationType } from '../types.js';

export function addParent(
  idea: Idea,
  parentId: string,
  relation: IdeaRelationType
): Idea {
  const parents = idea.parents ? [...idea.parents] : [];
  parents.push({ id: parentId, relation });
  return { ...idea, parents };
}

export function removeParent(idea: Idea, parentId: string): Idea {
  if (!idea.parents) return idea;
  return {
    ...idea,
    parents: idea.parents.filter((p) => p.id !== parentId),
  };
}

export function addEvidenceLink(
  idea: Idea,
  resultId: string,
  verdict: 'supported' | 'partial' | 'refuted'
): Idea {
  const links = idea.evidence_links ? [...idea.evidence_links] : [];
  links.push({ result: resultId, verdict });
  return { ...idea, evidence_links: links };
}

export function removeEvidenceLink(idea: Idea, resultId: string): Idea {
  if (!idea.evidence_links) return idea;
  return {
    ...idea,
    evidence_links: idea.evidence_links.filter((l) => l.result !== resultId),
  };
}

export function getParentIds(idea: Idea): string[] {
  return (idea.parents || []).map((p) => p.id);
}

export function getChildIds(
  ideas: Idea[],
  parentId: string
): string[] {
  return ideas
    .filter((idea) => idea.parents?.some((p) => p.id === parentId))
    .map((idea) => idea.id);
}

export function getRelatedIdeas(
  ideas: Idea[],
  ideaId: string,
  relation?: IdeaRelationType
): Idea[] {
  return ideas.filter((idea) =>
    idea.parents?.some(
      (p) => p.id === ideaId && (!relation || p.relation === relation)
    )
  );
}
