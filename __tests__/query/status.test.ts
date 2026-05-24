import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getStatusTree, getStatusJson } from '../../src/query/status.js';
import type { NodeMap, TypeIndex, Idea, Experiment } from '../../src/types.js';

describe('query/status', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-status-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function buildProjectReadme(name: string, status: string, created: string): string {
    const rd = path.join(tempDir, '.research');
    fs.mkdirSync(rd, { recursive: true });
    const content = `---\nname: "${name}"\nresearchQuestion: "test question"\nstatus: "${status}"\ncreated: "${created}"\n---\n`;
    fs.writeFileSync(path.join(rd, 'README.md'), content, 'utf-8');
    return rd;
  }

  function buildNodeMap(): {
    nodes: NodeMap;
    types: TypeIndex;
  } {
    const nodes: NodeMap = new Map();
    const types: TypeIndex = new Map();

    const idea1: Idea = {
      id: 'idea-fpn-cbam',
      type: 'idea',
      status: 'exploring',
      claim: 'CBAM helps detection',
      created: '2026-05-16',
    };

    const idea2: Idea = {
      id: 'idea-multi-scale',
      type: 'idea',
      status: 'validated',
      claim: 'Multi-scale training improves results',
      created: '2026-05-17',
    };

    const exp1: Experiment = {
      id: 'exp-001-baseline' as `exp-${number}-baseline`,
      type: 'experiment',
      idea: 'idea-fpn-cbam',
      status: 'completed',
      created: '2026-05-18',
    };

    const exp2: Experiment = {
      id: 'exp-002-fpn-cbam' as `exp-${number}-fpn-cbam`,
      type: 'experiment',
      idea: 'idea-fpn-cbam',
      status: 'running',
      created: '2026-05-19',
    };

    const exp3: Experiment = {
      id: 'exp-003-multi-scale' as `exp-${number}-multi-scale`,
      type: 'experiment',
      idea: 'idea-multi-scale',
      status: 'planned',
      created: '2026-05-20',
    };

    nodes.set('idea-fpn-cbam', idea1 as any);
    nodes.set('idea-multi-scale', idea2 as any);
    nodes.set('exp-001-baseline', exp1 as any);
    nodes.set('exp-002-fpn-cbam', exp2 as any);
    nodes.set('exp-003-multi-scale', exp3 as any);

    types.set('idea', new Set(['idea-fpn-cbam', 'idea-multi-scale']));
    types.set('experiment', new Set(['exp-001-baseline', 'exp-002-fpn-cbam', 'exp-003-multi-scale']));

    return { nodes, types };
  }

  describe('getStatusTree', () => {
    it('renders tree with ideas and experiments', async () => {
      buildProjectReadme('Small Object Detection', 'active', '2026-05-16');
      const { nodes, types } = buildNodeMap();

      const tree = await getStatusTree(nodes, types, tempDir);

      expect(tree).toContain('项目: Small Object Detection');
      expect(tree).toContain('思路: Fpn Cbam');
      expect(tree).toContain('思路: Multi Scale');
      expect(tree).toContain('001: Baseline');
      expect(tree).toContain('002: Fpn Cbam');
      expect(tree).toContain('003: Multi Scale');
      expect(tree).toContain('探索中');
      expect(tree).toContain('运行中');
      expect(tree).toContain('计划中');
    });

    it('returns empty tree when no nodes exist', async () => {
      buildProjectReadme('Empty Project', 'active', '2026-05-16');
      const nodes: NodeMap = new Map();
      const types: TypeIndex = new Map();

      const tree = await getStatusTree(nodes, types, tempDir);

      expect(tree).toContain('项目: Empty Project');
      expect(tree).not.toContain('思路');
    });
  });

  describe('getStatusJson', () => {
    it('returns structured json with ideas and experiments', async () => {
      buildProjectReadme('Small Object Detection', 'active', '2026-05-16');
      const { nodes, types } = buildNodeMap();

      const json = await getStatusJson(nodes, types, tempDir);

      expect(json.project).toBeDefined();
      expect((json.project as any).name).toBe('Small Object Detection');
      expect(json.ideas).toHaveLength(2);
      expect((json.ideas as any[])[0].experiments).toHaveLength(2);
      expect((json.ideas as any[])[1].experiments).toHaveLength(1);
    });
  });
});
