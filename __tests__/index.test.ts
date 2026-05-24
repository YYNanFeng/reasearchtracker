import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ResearchTracker } from '../src/index.js';

describe('ResearchTracker integration', () => {
  let tracker: ResearchTracker;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-test-'));
    tracker = new ResearchTracker();
  });

  afterEach(async () => {
    await tracker.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('init + open', () => {
    it('creates .research/ structure via init + initProject', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test-project', 'How to test?');

      expect(fs.existsSync(path.join(tempDir, '.research'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.research', 'README.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.research', 'config.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.research', 'state.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.research', '.gitignore'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.research', 'ideas'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.research', 'refs'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.research', 'logs'))).toBe(true);

      const gitignore = fs.readFileSync(
        path.join(tempDir, '.research', '.gitignore'),
        'utf-8'
      );
      expect(gitignore).toContain('state.yaml');
    });
  });

  describe('addIdea + getIdea', () => {
    it('adds an idea and retrieves it', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'test question');

      const idea = await tracker.addIdea({
        title: 'FPN CBAM',
        claim: 'Adding CBAM to FPN improves detection',
      });

      expect(idea.id).toBe('idea-fpn-cbam');
      expect(idea.type).toBe('idea');
      expect(idea.status).toBe('exploring');
      expect(idea.claim).toBe('Adding CBAM to FPN improves detection');

      const retrieved = await tracker.getIdea('idea-fpn-cbam');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('idea-fpn-cbam');
      expect(retrieved!.claim).toBe('Adding CBAM to FPN improves detection');
    });

    it('throws when adding duplicate idea', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      await tracker.addIdea({ title: 'FPN CBAM', claim: 'c1' });
      await expect(
        tracker.addIdea({ title: 'FPN CBAM', claim: 'c2' })
      ).rejects.toThrow("Idea 'idea-fpn-cbam' already exists");
    });
  });

  describe('listIdeas', () => {
    it('lists all ideas sorted by created', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      await tracker.addIdea({ title: 'Alpha', claim: 'claim a' });
      await tracker.addIdea({ title: 'Beta', claim: 'claim b' });

      const ideas = await tracker.listIdeas();
      expect(ideas).toHaveLength(2);
      const ids = ideas.map((i) => i.id);
      expect(ids).toContain('idea-alpha');
      expect(ids).toContain('idea-beta');
    });

    it('filters ideas by status', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      await tracker.addIdea({ title: 'Alpha', claim: 'c1' });
      const beta = await tracker.addIdea({ title: 'Beta', claim: 'c2' });
      await tracker.updateIdea(beta.id, { status: 'validated' });

      const exploring = await tracker.listIdeas({ status: 'exploring' });
      expect(exploring).toHaveLength(1);
      expect(exploring[0].id).toBe('idea-alpha');

      const validated = await tracker.listIdeas({ status: 'validated' });
      expect(validated).toHaveLength(1);
      expect(validated[0].id).toBe('idea-beta');
    });
  });

  describe('updateIdea', () => {
    it('updates status and sets updated date', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      const idea = await tracker.addIdea({ title: 'Test Idea', claim: 'original claim' });
      const updated = await tracker.updateIdea(idea.id, {
        status: 'validated',
        confidence: 0.85,
      });

      expect(updated.status).toBe('validated');
      expect(updated.confidence).toBe(0.85);
      expect(updated.updated).toBeDefined();
    });

    it('appends evidence links', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      const idea = await tracker.addIdea({ title: 'Test', claim: 'c' });
      const updated = await tracker.updateIdea(idea.id, {
        evidence_link: 'result-exp-001-test:supported',
      });

      expect(updated.evidence_links).toHaveLength(1);
      expect(updated.evidence_links![0]).toEqual({
        result: 'result-exp-001-test',
        verdict: 'supported',
      });
    });
  });

  describe('createExperiment + getExperiment', () => {
    it('creates an experiment under an idea and retrieves it', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      const idea = await tracker.addIdea({ title: 'FPN CBAM', claim: 'c' });
      const exp = await tracker.createExperiment({
        title: 'baseline',
        idea: idea.id,
        purpose: 'establish baseline',
      });

      expect(exp.id).toBe('exp-001-baseline');
      expect(exp.type).toBe('experiment');
      expect(exp.status).toBe('planned');
      expect(exp.idea).toBe('idea-fpn-cbam');
      expect(exp.purpose).toBe('establish baseline');

      const retrieved = await tracker.getExperiment('exp-001-baseline');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('exp-001-baseline');
    });

    it('increments experiment sequence globally', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      const idea1 = await tracker.addIdea({ title: 'Alpha', claim: 'c1' });
      const idea2 = await tracker.addIdea({ title: 'Beta', claim: 'c2' });

      const exp1 = await tracker.createExperiment({ title: 'first', idea: idea1.id });
      const exp2 = await tracker.createExperiment({ title: 'second', idea: idea2.id });

      expect(exp1.id).toBe('exp-001-first');
      expect(exp2.id).toBe('exp-002-second');
    });

    it('throws when idea does not exist', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      await expect(
        tracker.createExperiment({ title: 'test', idea: 'idea-nonexistent' })
      ).rejects.toThrow("Idea 'idea-nonexistent' not found");
    });
  });

  describe('listExperiments', () => {
    it('filters by idea', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      const idea1 = await tracker.addIdea({ title: 'Alpha', claim: 'c1' });
      const idea2 = await tracker.addIdea({ title: 'Beta', claim: 'c2' });

      await tracker.createExperiment({ title: 'exp-a1', idea: idea1.id });
      await tracker.createExperiment({ title: 'exp-b1', idea: idea2.id });

      const alphaExps = await tracker.listExperiments({ idea: idea1.id });
      expect(alphaExps).toHaveLength(1);
      expect(alphaExps[0].idea).toBe('idea-alpha');
    });

    it('filters by status', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      const idea = await tracker.addIdea({ title: 'Alpha', claim: 'c1' });
      const exp1 = await tracker.createExperiment({ title: 'first', idea: idea.id });
      await tracker.createExperiment({ title: 'second', idea: idea.id });
      await tracker.updateExperiment(exp1.id, { status: 'running' });

      const running = await tracker.listExperiments({ status: 'running' });
      expect(running).toHaveLength(1);
      expect(running[0].id).toBe('exp-001-first');
    });

    it('filters by tags', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      const idea = await tracker.addIdea({ title: 'Alpha', claim: 'c1' });
      await tracker.createExperiment({
        title: 'tagged',
        idea: idea.id,
        tags: 'gpu,fast',
      });
      await tracker.createExperiment({ title: 'untagged', idea: idea.id });

      const filtered = await tracker.listExperiments({ tags: 'gpu' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toContain('tagged');
    });
  });

  describe('updateExperiment', () => {
    it('updates status and sets updated date', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      const idea = await tracker.addIdea({ title: 'Test', claim: 'c' });
      const exp = await tracker.createExperiment({ title: 'exp1', idea: idea.id });

      const updated = await tracker.updateExperiment(exp.id, { status: 'running' });
      expect(updated.status).toBe('running');
      expect(updated.updated).toBeDefined();
    });

    it('throws when experiment does not exist', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      await expect(
        tracker.updateExperiment('exp-999-nope', { status: 'running' })
      ).rejects.toThrow("Experiment 'exp-999-nope' not found");
    });
  });

  describe('logResult', () => {
    it('logs a successful result with metrics', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      const idea = await tracker.addIdea({ title: 'Test', claim: 'c' });
      const exp = await tracker.createExperiment({ title: 'exp1', idea: idea.id });

      const result = await tracker.logResult({
        experiment_id: exp.id,
        claim: 'mAP improved by 2%',
        evidence: 'eval results table',
        status: 'success',
        metrics: '{"mAP": 0.42, "FPS": 30}',
      });

      expect(result.id).toBe(`result-${exp.id}`);
      expect(result.type).toBe('result');
      expect(result.status).toBe('success');
      expect(result.claim).toBe('mAP improved by 2%');
      expect(result.metrics).toEqual({ mAP: 0.42, FPS: 30 });
    });

    it('logs a failed result without metrics', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      const idea = await tracker.addIdea({ title: 'Test', claim: 'c' });
      const exp = await tracker.createExperiment({ title: 'exp1', idea: idea.id });

      const result = await tracker.logResult({
        experiment_id: exp.id,
        claim: 'OOM error',
        evidence: 'stack trace',
        status: 'failed',
      });

      expect(result.status).toBe('failed');
      expect(result.metrics).toBeUndefined();
    });

    it('throws when success without metrics', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      const idea = await tracker.addIdea({ title: 'Test', claim: 'c' });
      const exp = await tracker.createExperiment({ title: 'exp1', idea: idea.id });

      await expect(
        tracker.logResult({
          experiment_id: exp.id,
          claim: 'good',
          evidence: 'e',
          status: 'success',
        })
      ).rejects.toThrow('Metrics are required when status is success');
    });
  });

  describe('addReference + listReferences', () => {
    it('adds a reference and lists it', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      const ref = await tracker.addReference({
        key: 'lin2017fpn',
        title: 'Feature Pyramid Networks',
        authors: 'Lin et al.',
        year: 2017,
        venue: 'CVPR',
      });

      expect(ref.key).toBe('lin2017fpn');
      expect(ref.title).toBe('Feature Pyramid Networks');
      expect(ref.year).toBe(2017);

      const refs = await tracker.listReferences();
      expect(refs).toHaveLength(1);
      expect(refs[0].key).toBe('lin2017fpn');
    });

    it('throws on duplicate reference', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      await tracker.addReference({
        key: 'lin2017fpn',
        title: 'FPN',
        authors: 'Lin',
        year: 2017,
      });

      await expect(
        tracker.addReference({
          key: 'lin2017fpn',
          title: 'FPN v2',
          authors: 'Lin',
          year: 2018,
        })
      ).rejects.toThrow("Reference 'lin2017fpn' already exists");
    });
  });

  describe('addLog', () => {
    it('creates a log entry', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      const entry = await tracker.addLog('Started new experiment run');
      expect(entry.type).toBe('log');
      expect(entry.date).toBeDefined();

      const today = new Date().toISOString().split('T')[0];
      expect(entry.date).toBe(today);

      const logPath = path.join(tempDir, '.research', 'logs', `${today}.md`);
      expect(fs.existsSync(logPath)).toBe(true);
      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content).toContain('Started new experiment run');
    });
  });

  describe('search', () => {
    it('finds nodes by keyword in frontmatter', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      await tracker.addIdea({
        title: 'FPN CBAM',
        claim: 'CBAM attention module helps detection',
      });
      await tracker.addIdea({
        title: 'YOLO v8',
        claim: 'Anchor-free approach',
      });

      const results = await tracker.search('CBAM');
      expect(results.length).toBeGreaterThanOrEqual(1);
      const found = results.some((r) => r.id === 'idea-fpn-cbam');
      expect(found).toBe(true);
    });

    it('returns empty for no match', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      await tracker.addIdea({ title: 'Test', claim: 'hello world' });
      const results = await tracker.search('zzz_nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('validate', () => {
    it('passes validation for valid data', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      await tracker.addIdea({ title: 'Test', claim: 'valid claim' });
      const idea = await tracker.getIdea('idea-test');
      await tracker.createExperiment({ title: 'exp1', idea: idea!.id });

      const result = await tracker.validate();
      expect(result.valid).toBe(true);
    });

    it('detects broken references', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      await tracker.addIdea({ title: 'Alpha', claim: 'c1' });
      await tracker.addIdea({ title: 'Beta', claim: 'c2' });

      const expDir = path.join(
        tempDir, '.research', 'ideas', 'alpha', 'experiments'
      );
      fs.mkdirSync(path.join(expDir, 'exp-099-orphan'), { recursive: true });
      const expContent = [
        '---',
        'id: "exp-099-orphan"',
        'type: "experiment"',
        'status: "planned"',
        'idea: "idea-nonexistent"',
        'created: "2026-05-20"',
        '---',
        '',
      ].join('\n');
      fs.writeFileSync(path.join(expDir, 'exp-099-orphan', 'README.md'), expContent, 'utf-8');

      await tracker.incrementalScan();

      const result = await tracker.validate();
      const broken = result.issues.some(
        (i) => i.message.includes('Referenced idea') && i.level === 'error'
      );
      expect(broken).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('returns a non-empty tree string', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('status-project', 'how is it?');

      await tracker.addIdea({ title: 'FPN', claim: 'improve FPN' });
      const idea = await tracker.getIdea('idea-fpn');
      await tracker.createExperiment({ title: 'baseline', idea: idea!.id });

      const status = await tracker.getStatus();
      expect(typeof status).toBe('string');
      expect(status.length).toBeGreaterThan(0);
      expect(status).toContain('status-project');
    });

    it('returns json format', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('json-proj', 'q');

      const json = await tracker.getStatus('json');
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('project');
      expect(parsed).toHaveProperty('ideas');
    });
  });

  describe('compare', () => {
    it('compares two experiments with results in table format', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      const idea = await tracker.addIdea({ title: 'Test', claim: 'c' });

      const exp1 = await tracker.createExperiment({ title: 'baseline', idea: idea.id });
      await tracker.logResult({
        experiment_id: exp1.id,
        claim: 'baseline result',
        evidence: 'table',
        status: 'success',
        metrics: '{"mAP": 0.35, "FPS": 45}',
      });

      const exp2 = await tracker.createExperiment({ title: 'improved', idea: idea.id });
      await tracker.logResult({
        experiment_id: exp2.id,
        claim: 'improved result',
        evidence: 'table',
        status: 'success',
        metrics: '{"mAP": 0.42, "FPS": 38}',
      });

      const table = await tracker.compare([exp1.id, exp2.id]);
      expect(table).toContain('Metric');
      expect(table).toContain('mAP');
      expect(table).toContain('FPS');
      expect(table).toContain('0.35');
      expect(table).toContain('0.42');
    });

    it('throws for nonexistent experiment', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      await expect(
        tracker.compare(['exp-999-nope'])
      ).rejects.toThrow("Experiment 'exp-999-nope' not found");
    });
  });

  describe('config get/set', () => {
    it('sets and gets config values', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      await tracker.setConfig('version', '2');
      const config = await tracker.getConfig();
      expect(config.version).toBe('2');
    });

    it('sets arbitrary config keys', async () => {
      await tracker.init(tempDir);
      await tracker.initProject('test', 'q');

      await tracker.setConfig('customKey', 'customValue');
      const config = await tracker.getConfig();
      expect((config as Record<string, unknown>)['customKey']).toBe('customValue');
    });
  });
});
