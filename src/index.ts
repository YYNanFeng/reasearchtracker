import * as fs from 'node:fs';
import * as path from 'node:path';
import * as YAML from 'yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import type {
  BaseNode, NodeMap, TypeIndex,
  Idea, Experiment, Result, Reference, LogEntry,
  ProjectInfo, Config, ProjectConfig, ResolvedProjectConfig, State,
  IdeaInput, ExperimentInput, ResultInput, ReferenceInput,
  IdeaFilter, ExperimentFilter, TimelineFilter,
  SearchResult, TimelineEntry, ValidationResult, ValidationIssue as AppValidationIssue,
  HookEvent,
  AutoUpdateFieldAction, AutoCreateEntityAction, AutoLogAction,
} from './types.js';

import { scanDirectory, getNextExperimentSeq, getNextExperimentSeqForIdea, slugify, ideaIdToSlug } from './storage/scanner.js';
import { readMarkdown, writeMarkdown, appendToFile, fileExists, ensureDir } from './storage/markdown.js';
import { updateFrontmatter } from './storage/frontmatter.js';
import { getIdea as getIdeaNode, getExperiment as getExpNode, getExperimentsForIdea, getResultForExperiment } from './graph/nodes.js';
import { getIdeaTree } from './graph/query.js';
import { searchNodes } from './query/search.js';
import { buildTimeline } from './query/timeline.js';
import { getStatusTree, getStatusJson } from './query/status.js';
import { getHeadCommit } from './git/commits.js';
import { resolveConfig } from './config/defaults.js';
import { validateConfig, ValidationIssue as ConfigValidationIssue } from './config/validator.js';
import { HooksEngine, HookActionExecutor, HookResult, extractTemplateVariables, renderTemplate } from './hooks/engine.js';

function loadSchema(name: string): object {
  const p = path.join(__dirname, 'schemas', name);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

const projectSchema = loadSchema('project.json');
const ideaSchema = loadSchema('idea.json');
const experimentSchema = loadSchema('experiment.json');
const resultSchema = loadSchema('result.json');
const logSchema = loadSchema('log.json');
const referenceSchema = loadSchema('reference.json');

export class ResearchTracker implements HookActionExecutor {
  private nodeIndex: NodeMap = new Map();
  private typeIndex: TypeIndex = new Map();
  private _rootDir: string = '';
  private _researchDir: string = '';
  private _resolvedConfig: ResolvedProjectConfig | null = null;
  private _hooksEngine: HooksEngine | null = null;
  private _configWarnings: ConfigValidationIssue[] = [];

  get rootDir(): string { return this._rootDir; }
  get researchDir(): string { return this._researchDir; }
  get resolvedConfig(): ResolvedProjectConfig {
    return this._resolvedConfig ?? resolveConfig({ version: '1' });
  }

  async init(rootDir: string): Promise<void> {
    this._rootDir = path.resolve(rootDir);
    this._researchDir = path.join(this._rootDir, '.research');
    await this.loadConfig();
    await this.scan();
  }

  async open(rootDir: string): Promise<void> {
    await this.init(rootDir);
  }

  async close(): Promise<void> {
    this.nodeIndex.clear();
    this.typeIndex.clear();
    this._resolvedConfig = null;
    this._hooksEngine = null;
  }

  private async loadConfig(): Promise<void> {
    const configPath = path.join(this._researchDir, 'config.yaml');
    let rawConfig: ProjectConfig = { version: '1' };
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      rawConfig = YAML.parse(raw) as ProjectConfig;
    }
    this._configWarnings = validateConfig(rawConfig);
    this._resolvedConfig = resolveConfig(rawConfig);
    this._hooksEngine = new HooksEngine(this._resolvedConfig.hooks, this);
  }

  getConfigWarnings(): ConfigValidationIssue[] {
    return this._configWarnings;
  }

  private async scan(): Promise<void> {
    const result = await scanDirectory(this._rootDir);
    this.nodeIndex = result.nodes;
    this.typeIndex = result.types;
  }

  async incrementalScan(): Promise<void> {
    await this.scan();
  }

  getNode(id: string): BaseNode | undefined {
    return this.nodeIndex.get(id);
  }

  getAllNodes(): NodeMap {
    return this.nodeIndex;
  }

  getTypeIndex(): TypeIndex {
    return this.typeIndex;
  }

  // ============ Init ============

  async initProject(name: string, question: string): Promise<void> {
    const rd = this._researchDir;
    ensureDir(rd);
    ensureDir(path.join(rd, 'ideas'));
    ensureDir(path.join(rd, 'refs'));
    ensureDir(path.join(rd, 'logs'));

    fs.writeFileSync(
      path.join(rd, '.gitignore'),
      'state.yaml\n',
      'utf-8'
    );

    const config: Config = { version: '1' };
    fs.writeFileSync(
      path.join(rd, 'config.yaml'),
      YAML.stringify(config),
      'utf-8'
    );

    const state: State = {};
    fs.writeFileSync(
      path.join(rd, 'state.yaml'),
      YAML.stringify(state),
      'utf-8'
    );

    const projectData: Record<string, unknown> = {
      name,
      researchQuestion: question,
      status: 'active',
      created: new Date().toISOString().split('T')[0],
    };
    writeMarkdown(path.join(rd, 'README.md'), projectData);

    await this.scan();
  }

  // ============ Idea ============

  async addIdea(input: IdeaInput): Promise<Idea> {
    const slug = slugify(input.title);
    const id = `idea-${slug}`;
    const ideaDir = path.join(this._researchDir, 'ideas', slug);

    if (this.nodeIndex.has(id)) {
      throw new Error(`Idea '${id}' already exists`);
    }

    const cfg = this.resolvedConfig;
    const initialStatus = cfg.statusFlow.idea?.initial ?? 'exploring';
    const fieldDefaults = cfg.fields.idea?.defaults ?? {};

    const data: Record<string, unknown> = {
      id,
      type: 'idea',
      status: initialStatus,
      claim: input.claim,
      created: new Date().toISOString().split('T')[0],
    };

    for (const [key, value] of Object.entries(fieldDefaults)) {
      if (data[key] === undefined) data[key] = value;
    }

    if (input.evidence) data.evidence = input.evidence;
    if (input.confidence !== undefined) data.confidence = input.confidence;
    if (input.tags) data.tags = input.tags.split(',').map((t) => t.trim());

    if (input.parents) {
      data.parents = input.parents.split(',').map((p) => {
        const [id, relation] = p.split(':');
        return { id: id.trim(), relation: relation?.trim() || 'builds_on' };
      });
    }

    if (input.extra && cfg.customFields.enabled) {
      for (const [key, value] of Object.entries(input.extra)) {
        if (data[key] === undefined) data[key] = value;
      }
    }

    const requiredFields = cfg.fields.idea?.required ?? [];
    for (const field of requiredFields) {
      if (data[field] === undefined && input[field as keyof IdeaInput] === undefined) {
        throw new Error(`Required field '${field}' is missing`);
      }
    }

    ensureDir(ideaDir);
    writeMarkdown(path.join(ideaDir, 'README.md'), data, input.body);

    await this.updateState({ active: { idea: id } });
    await this.scan();

    return this.nodeIndex.get(id) as unknown as Idea;
  }

  async getIdea(id: string): Promise<Idea | null> {
    return getIdeaNode(this.nodeIndex, id);
  }

  async listIdeas(filter?: IdeaFilter): Promise<Idea[]> {
    let ideas = Array.from(this.typeIndex.get('idea') || [])
      .map((id) => this.nodeIndex.get(id) as unknown as Idea)
      .filter(Boolean)
      .sort((a, b) => a.created.localeCompare(b.created));

    if (filter?.status) {
      ideas = ideas.filter((i) => i.status === filter.status);
    }
    return ideas;
  }

  async updateIdea(id: string, updates: { status?: string; confidence?: number; evidence?: string; evidence_link?: string }): Promise<Idea> {
    const current = getIdeaNode(this.nodeIndex, id);
    if (!current) throw new Error(`Idea '${id}' not found`);

    if (updates.status) {
      const cfg = this.resolvedConfig;
      const transitions = cfg.statusFlow.idea?.transitions;
      if (transitions && current.status !== updates.status) {
        const allowed = transitions[current.status];
        if (allowed && !allowed.includes(updates.status)) {
          throw new Error(`Invalid status transition for idea: '${current.status}' → '${updates.status}'. Allowed: ${allowed.join(', ')}`);
        }
      }

      if (this._hooksEngine) {
        const event: HookEvent = {
          eventType: 'idea_status_change',
          entityId: id,
          entityType: 'idea',
          fromStatus: current.status,
          toStatus: updates.status,
        };
        const beforeResult = await this._hooksEngine.executeBefore(event);
        if (!beforeResult.success) {
          throw new Error(beforeResult.error ?? 'Hook blocked the operation');
        }
      }
    }

    const slug = ideaIdToSlug(id);
    const filePath = path.join(this._researchDir, 'ideas', slug, 'README.md');
    const fmUpdates: Record<string, unknown> = {};

    if (updates.status) {
      fmUpdates.status = updates.status;
      fmUpdates.updated = new Date().toISOString().split('T')[0];
    }
    if (updates.confidence !== undefined) fmUpdates.confidence = updates.confidence;
    if (updates.evidence) fmUpdates.evidence = updates.evidence;

    if (updates.evidence_link) {
      const [result, verdict] = updates.evidence_link.split(':');
      const existingLinks = current.evidence_links || [];
      existingLinks.push({ result, verdict: verdict as 'supported' | 'partial' | 'refuted' });
      fmUpdates.evidence_links = existingLinks;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const updated = updateFrontmatter(raw, fmUpdates);
    fs.writeFileSync(filePath, updated, 'utf-8');

    await this.scan();

    if (updates.status && this._hooksEngine) {
      const event: HookEvent = {
        eventType: 'idea_status_change',
        entityId: id,
        entityType: 'idea',
        fromStatus: current.status,
        toStatus: updates.status,
      };
      await this._hooksEngine.executeAfter(event);
    }

    return this.nodeIndex.get(id) as unknown as Idea;
  }

  // ============ Experiment ============

  async createExperiment(input: ExperimentInput): Promise<Experiment> {
    const ideaSlug = ideaIdToSlug(input.idea);
    const ideaDir = path.join(this._researchDir, 'ideas', ideaSlug);
    if (!fs.existsSync(ideaDir)) {
      throw new Error(`Idea '${input.idea}' not found`);
    }

    const cfg = this.resolvedConfig;
    const initialStatus = cfg.statusFlow.experiment?.initial ?? 'planned';
    const fieldDefaults = cfg.fields.experiment?.defaults ?? {};

    let seq: number;
    if (cfg.numbering.mode === 'per-idea') {
      seq = getNextExperimentSeqForIdea(this._rootDir, ideaSlug);
    } else {
      seq = await getNextExperimentSeq(this._rootDir);
    }
    const seqStr = String(seq).padStart(3, '0');
    const slug = slugify(input.title);
    const id = `exp-${seqStr}-${slug}`;
    const expDir = path.join(ideaDir, 'experiments', id);

    if (this.nodeIndex.has(id)) {
      throw new Error(`Experiment '${id}' already exists`);
    }

    const data: Record<string, unknown> = {
      id,
      type: 'experiment',
      idea: input.idea,
      status: initialStatus,
      created: new Date().toISOString().split('T')[0],
    };

    for (const [key, value] of Object.entries(fieldDefaults)) {
      if (data[key] === undefined) data[key] = value;
    }

    if (input.purpose) data.purpose = input.purpose;
    if (input.based_on) data.based_on = input.based_on;
    if (input.tags) data.tags = input.tags.split(',').map((t) => t.trim());
    if (input.commits) data.commits = input.commits.split(',').map((c) => c.trim());

    if (input.extra && cfg.customFields.enabled) {
      for (const [key, value] of Object.entries(input.extra)) {
        if (data[key] === undefined) data[key] = value;
      }
    }

    const requiredFields = cfg.fields.experiment?.required ?? [];
    for (const field of requiredFields) {
      if (data[field] === undefined && input[field as keyof ExperimentInput] === undefined) {
        throw new Error(`Required field '${field}' is missing`);
      }
    }

    ensureDir(expDir);
    writeMarkdown(path.join(expDir, 'README.md'), data, input.body);

    await this.updateState({ active: { experiment: id } });
    await this.scan();

    return this.nodeIndex.get(id) as unknown as Experiment;
  }

  async getExperiment(id: string): Promise<Experiment | null> {
    return getExpNode(this.nodeIndex, id);
  }

  async listExperiments(filter?: ExperimentFilter): Promise<Experiment[]> {
    let exps = Array.from(this.typeIndex.get('experiment') || [])
      .map((id) => this.nodeIndex.get(id) as unknown as Experiment)
      .filter(Boolean);

    if (filter?.idea) exps = exps.filter((e) => e.idea === filter.idea);
    if (filter?.status) exps = exps.filter((e) => e.status === filter.status);
    if (filter?.tags) {
      const tags = filter.tags.split(',').map((t) => t.trim());
      exps = exps.filter(
        (e) => e.tags && tags.some((t) => e.tags!.includes(t))
      );
    }

    return exps.sort((a, b) => {
      const seqA = parseInt((a.id.match(/exp-(\d+)/) || [])[1] || '0', 10);
      const seqB = parseInt((b.id.match(/exp-(\d+)/) || [])[1] || '0', 10);
      return seqA - seqB;
    });
  }

  async updateExperiment(id: string, updates: { status?: string; commits?: string }): Promise<Experiment> {
    const current = getExpNode(this.nodeIndex, id);
    if (!current) throw new Error(`Experiment '${id}' not found`);

    if (updates.status) {
      const cfg = this.resolvedConfig;
      const transitions = cfg.statusFlow.experiment?.transitions;
      if (transitions && current.status !== updates.status) {
        const allowed = transitions[current.status];
        if (allowed && !allowed.includes(updates.status)) {
          throw new Error(`Invalid status transition for experiment: '${current.status}' → '${updates.status}'. Allowed: ${allowed.join(', ')}`);
        }
      }

      if (this._hooksEngine) {
        const event: HookEvent = {
          eventType: 'experiment_status_change',
          entityId: id,
          entityType: 'experiment',
          fromStatus: current.status,
          toStatus: updates.status,
          parentIdeaId: current.idea,
        };
        const beforeResult = await this._hooksEngine.executeBefore(event);
        if (!beforeResult.success) {
          throw new Error(beforeResult.error ?? 'Hook blocked the operation');
        }
      }
    }

    const expDir = await this.findExperimentDir(id);
    if (!expDir) throw new Error(`Experiment directory for '${id}' not found`);

    const filePath = path.join(expDir, 'README.md');
    const fmUpdates: Record<string, unknown> = {};

    if (updates.status) {
      fmUpdates.status = updates.status;
      fmUpdates.updated = new Date().toISOString().split('T')[0];

      const cfg = this.resolvedConfig;
      if (cfg.git.enabled) {
        const autoAttach = cfg.git.autoAttachCommitOnStatus ?? {};
        if (autoAttach[updates.status]) {
          const headCommit = getHeadCommit(this._rootDir);
          if (headCommit) {
            const existingCommits = current.commits || [];
            if (!existingCommits.includes(headCommit)) {
              fmUpdates.commits = [...existingCommits, headCommit];
            }
          }
        }
      }
    }

    if (updates.commits) {
      const newCommits = updates.commits.split(',').map((c) => c.trim());
      fmUpdates.commits = [...(current.commits || []), ...newCommits];
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const updated = updateFrontmatter(raw, fmUpdates);
    fs.writeFileSync(filePath, updated, 'utf-8');

    await this.scan();

    if (updates.status && this._hooksEngine) {
      const event: HookEvent = {
        eventType: 'experiment_status_change',
        entityId: id,
        entityType: 'experiment',
        fromStatus: current.status,
        toStatus: updates.status,
        parentIdeaId: current.idea,
      };
      await this._hooksEngine.executeAfter(event);
    }

    return this.nodeIndex.get(id) as unknown as Experiment;
  }

  async logResult(input: ResultInput): Promise<Result> {
    const exp = getExpNode(this.nodeIndex, input.experiment_id);
    if (!exp) throw new Error(`Experiment '${input.experiment_id}' not found`);

    if (input.status === 'success' && !input.metrics) {
      throw new Error('Metrics are required when status is success');
    }

    const cfg = this.resolvedConfig;
    const requiredKeys = cfg.metrics.requiredKeys ?? [];
    const ranges = cfg.metrics.ranges ?? {};

    if (input.metrics && requiredKeys.length > 0) {
      const parsedMetrics = typeof input.metrics === 'string'
        ? JSON.parse(input.metrics) as Record<string, number>
        : input.metrics;
      for (const key of requiredKeys) {
        if (parsedMetrics[key] === undefined) {
          throw new Error(`Required metric '${key}' is missing`);
        }
      }
      for (const [key, range] of Object.entries(ranges)) {
        if (parsedMetrics[key] !== undefined) {
          if (range.min !== undefined && parsedMetrics[key] < range.min) {
            process.stderr.write(`Warning: metric '${key}' value ${parsedMetrics[key]} is below minimum ${range.min}\n`);
          }
          if (range.max !== undefined && parsedMetrics[key] > range.max) {
            process.stderr.write(`Warning: metric '${key}' value ${parsedMetrics[key]} is above maximum ${range.max}\n`);
          }
        }
      }
    }

    const id = `result-${input.experiment_id}`;
    const expDir = await this.findExperimentDir(input.experiment_id);
    if (!expDir) throw new Error(`Experiment directory for '${input.experiment_id}' not found`);

    const data: Record<string, unknown> = {
      id,
      type: 'result',
      experiment: input.experiment_id,
      status: input.status,
      claim: input.claim,
      evidence: input.evidence,
      created: new Date().toISOString().split('T')[0],
    };

    if (input.metrics) {
      data.metrics = typeof input.metrics === 'string'
        ? JSON.parse(input.metrics)
        : input.metrics;
    }

    if (input.extra && cfg.customFields.enabled) {
      for (const [key, value] of Object.entries(input.extra)) {
        if (data[key] === undefined) data[key] = value;
      }
    }

    writeMarkdown(path.join(expDir, 'result.md'), data, input.body);
    await this.scan();

    if (this._hooksEngine) {
      const event: HookEvent = {
        eventType: 'result_created',
        entityId: id,
        entityType: 'experiment',
        experimentId: input.experiment_id,
        parentIdeaId: exp.idea,
        resultStatus: input.status,
      };
      await this._hooksEngine.executeResultCreated(event);
    }

    return this.nodeIndex.get(id) as unknown as Result;
  }

  // ============ Reference ============

  async addReference(input: ReferenceInput): Promise<Reference> {
    const filePath = path.join(this._researchDir, 'refs', `${input.key}.md`);

    if (fs.existsSync(filePath)) {
      throw new Error(`Reference '${input.key}' already exists`);
    }

    const data: Record<string, unknown> = {
      key: input.key,
      title: input.title,
      authors: input.authors,
      year: input.year,
    };

    if (input.venue) data.venue = input.venue;
    if (input.url) data.url = input.url;
    if (input.tags) data.tags = input.tags.split(',').map((t) => t.trim());

    writeMarkdown(filePath, data, input.body);
    await this.scan();

    return { ...input, tags: input.tags ? input.tags.split(',').map((t) => t.trim()) : undefined };
  }

  async listReferences(): Promise<Reference[]> {
    return Array.from(this.typeIndex.get('reference') || [])
      .map((id) => {
        const node = this.nodeIndex.get(id);
        return node as unknown as Reference;
      })
      .filter(Boolean);
  }

  // ============ Log ============

  async addLog(content: string): Promise<LogEntry> {
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toISOString().split('T')[1].substring(0, 5);
    const filePath = path.join(this._researchDir, 'logs', `${date}.md`);

    if (!fs.existsSync(filePath)) {
      const data: Record<string, unknown> = {
        type: 'log',
        date,
      };
      writeMarkdown(filePath, data);
    }

    appendToFile(filePath, `\n## ${time} — ${content}\n\n`);

    return { type: 'log', date };
  }

  // ============ Query ============

  async getStatus(format?: string): Promise<string> {
    if (format === 'json') {
      const json = await getStatusJson(this.nodeIndex, this.typeIndex, this._rootDir);
      return JSON.stringify(json, null, 2);
    }
    return getStatusTree(this.nodeIndex, this.typeIndex, this._rootDir);
  }

  async search(keyword: string): Promise<SearchResult[]> {
    return searchNodes(this.nodeIndex, keyword, this._rootDir);
  }

  async getTimeline(filter?: TimelineFilter): Promise<TimelineEntry[]> {
    return buildTimeline(this._rootDir, filter);
  }

  async compare(experimentIds: string[], format?: string): Promise<string> {
    const experiments: Array<{ exp: Experiment; result: Result | null }> = [];

    for (const id of experimentIds) {
      const exp = getExpNode(this.nodeIndex, id);
      if (!exp) throw new Error(`Experiment '${id}' not found`);
      const result = getResultForExperiment(this.nodeIndex, this.typeIndex, id);
      experiments.push({ exp, result });
    }

    if (format === 'json') {
      return JSON.stringify(experiments, null, 2);
    }

    const allKeys = new Set<string>();
    for (const { result } of experiments) {
      if (result?.metrics) {
        for (const key of Object.keys(result.metrics)) {
          allKeys.add(key);
        }
      }
    }

    const header = ['Metric', ...experimentIds].join(' | ');
    const separator = ['---', ...experimentIds.map(() => '---')].join(' | ');
    const rows = Array.from(allKeys).map((key) => {
      const values = experiments.map(({ result }) => {
        const val = result?.metrics?.[key];
        return val !== undefined ? String(val) : '-';
      });
      return [key, ...values].join(' | ');
    });

    return [header, separator, ...rows].join('\n');
  }

  // ============ Validate ============

  async validate(): Promise<ValidationResult> {
    const issues: AppValidationIssue[] = [];
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    const schemaMap: Record<string, object> = {
      idea: ideaSchema,
      experiment: experimentSchema,
      result: resultSchema,
      log: logSchema,
      reference: referenceSchema,
    };

    const cfg = this.resolvedConfig;

    if (cfg.customFields.enabled && cfg.customFields.schema) {
      for (const [entityType, fieldDefs] of Object.entries(cfg.customFields.schema)) {
        if (!fieldDefs || entityType === 'reference' || entityType === 'log') continue;
        const baseSchema = schemaMap[entityType];
        if (!baseSchema) continue;
        const extendedSchema = JSON.parse(JSON.stringify(baseSchema));
        if (extendedSchema.additionalProperties === false) {
          delete extendedSchema.additionalProperties;
        }
        if (!extendedSchema.properties) extendedSchema.properties = {};
        for (const [fieldName, fieldDef] of Object.entries(fieldDefs)) {
          extendedSchema.properties[fieldName] = jsonSchemaFromCustomField(fieldDef);
        }
        schemaMap[entityType] = extendedSchema;
      }
    }

    for (const [id, node] of this.nodeIndex) {
      const type = node.type;
      const schema = schemaMap[type];
      if (!schema) continue;

      const validate = ajv.compile(schema);
      const valid = validate(node);
      if (!valid && validate.errors) {
        for (const err of validate.errors) {
          issues.push({
            level: 'error',
            file: id,
            message: `${err.instancePath} ${err.message || 'validation error'}`,
          });
        }
      }
    }

    for (const [id, node] of this.nodeIndex) {
      if (node.type === 'experiment') {
        const exp = node as unknown as Experiment;
        if (!this.nodeIndex.has(exp.idea)) {
          issues.push({
            level: 'error',
            file: id,
            message: `Referenced idea '${exp.idea}' not found`,
          });
        }
      }
      if (node.type === 'result') {
        const result = node as unknown as Result;
        if (!this.nodeIndex.has(result.experiment)) {
          issues.push({
            level: 'error',
            file: id,
            message: `Referenced experiment '${result.experiment}' not found`,
          });
        }
      }
    }

    if (cfg.version === '2') {
      const rawConfig = await this.getConfig() as ProjectConfig;
      const configIssues = validateConfig(rawConfig);
      for (const ci of configIssues) {
        issues.push({
          level: ci.level,
          file: 'config.yaml',
          message: `${ci.path}: ${ci.message}`,
        });
      }

      if (cfg.statusFlow.idea?.transitions) {
        for (const [id, node] of this.nodeIndex) {
          if (node.type === 'idea') {
            const idea = node as unknown as Idea;
            const allowed = cfg.statusFlow.idea.transitions[idea.status];
            if (allowed && allowed.length === 0) {
              issues.push({
                level: 'warning',
                file: id,
                message: `Idea is in terminal state '${idea.status}'`,
              });
            }
          }
        }
      }

      if (cfg.statusFlow.experiment?.transitions) {
        for (const [id, node] of this.nodeIndex) {
          if (node.type === 'experiment') {
            const exp = node as unknown as Experiment;
            const allowed = cfg.statusFlow.experiment.transitions[exp.status];
            if (allowed && allowed.length === 0) {
              issues.push({
                level: 'warning',
                file: id,
                message: `Experiment is in terminal state '${exp.status}'`,
              });
            }
          }
        }
      }
    }

    return {
      valid: issues.filter((i) => i.level === 'error').length === 0,
      issues,
    };
  }

  // ============ Project Info ============

  async getProjectInfo(): Promise<ProjectInfo | null> {
    const readmePath = path.join(this._researchDir, 'README.md');
    if (!fs.existsSync(readmePath)) return null;
    const mf = readMarkdown(readmePath);
    return mf.data as unknown as ProjectInfo;
  }

  async updateProjectInfo(info: Partial<ProjectInfo>): Promise<void> {
    const readmePath = path.join(this._researchDir, 'README.md');
    const raw = fs.readFileSync(readmePath, 'utf-8');
    const updated = updateFrontmatter(raw, info as Record<string, unknown>);
    fs.writeFileSync(readmePath, updated, 'utf-8');
  }

  // ============ Config ============

  async getConfig(resolved?: boolean): Promise<Config | ResolvedProjectConfig> {
    const configPath = path.join(this._researchDir, 'config.yaml');
    let rawConfig: ProjectConfig = { version: '1' };
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      rawConfig = YAML.parse(raw) as ProjectConfig;
    }
    if (resolved) {
      return resolveConfig(rawConfig);
    }
    return rawConfig as Config;
  }

  async getResolvedConfig(): Promise<ResolvedProjectConfig> {
    return this.resolvedConfig;
  }

  async setConfig(key: string, value: string): Promise<void> {
    const configPath = path.join(this._researchDir, 'config.yaml');
    let config: Record<string, unknown> = {};
    if (fs.existsSync(configPath)) {
      config = YAML.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    }

    setNestedValue(config, key, parseConfigValue(value));

    if (!config.version) config.version = '2';
    fs.writeFileSync(configPath, YAML.stringify(config), 'utf-8');
    await this.loadConfig();
  }

  async validateConfigAlone(): Promise<ConfigValidationIssue[]> {
    const configPath = path.join(this._researchDir, 'config.yaml');
    if (!fs.existsSync(configPath)) return [];
    const raw = fs.readFileSync(configPath, 'utf-8');
    const rawConfig = YAML.parse(raw) as ProjectConfig;
    return validateConfig(rawConfig);
  }

  async getState(): Promise<State> {
    const statePath = path.join(this._researchDir, 'state.yaml');
    if (!fs.existsSync(statePath)) return {};
    const raw = fs.readFileSync(statePath, 'utf-8');
    return YAML.parse(raw) as State;
  }

  async setState(state: Partial<State>): Promise<void> {
    const currentState = await this.getState();
    const merged = { ...currentState, ...state };
    if (state.active) {
      merged.active = { ...currentState.active, ...state.active };
    }
    const statePath = path.join(this._researchDir, 'state.yaml');
    fs.writeFileSync(statePath, YAML.stringify(merged), 'utf-8');
  }

  // ============ Internal ============

  private async updateState(partial: Partial<State>): Promise<void> {
    const current = await this.getState();
    const merged: State = { ...current };
    if (partial.active) {
      merged.active = { ...current.active, ...partial.active };
    }
    const statePath = path.join(this._researchDir, 'state.yaml');
    fs.writeFileSync(statePath, YAML.stringify(merged), 'utf-8');
  }

  private async findExperimentDir(expId: string): Promise<string | null> {
    const ideaDirs = fs.readdirSync(path.join(this._researchDir, 'ideas'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const ideaSlug of ideaDirs) {
      const expDir = path.join(
        this._researchDir, 'ideas', ideaSlug, 'experiments', expId
      );
      if (fs.existsSync(expDir)) return expDir;
    }
    return null;
  }

  getNextExperimentSeq(): number {
    let maxSeq = 0;
    const ideasDir = path.join(this._researchDir, 'ideas');
    if (!fs.existsSync(ideasDir)) return 1;

    const ideaDirs = fs.readdirSync(ideasDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const ideaSlug of ideaDirs) {
      const expsDir = path.join(ideasDir, ideaSlug, 'experiments');
      if (!fs.existsSync(expsDir)) continue;
      const expDirs = fs.readdirSync(expsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      for (const dirName of expDirs) {
        const match = dirName.match(/^exp-(\d+)/);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (seq > maxSeq) maxSeq = seq;
        }
      }
    }

    return maxSeq + 1;
  }

  // ============ HookActionExecutor ============

  async updateField(action: AutoUpdateFieldAction, event: HookEvent): Promise<HookResult> {
    try {
      let targetId = event.entityId;
      if (action.locateBy === 'parent') {
        targetId = event.parentIdeaId ?? event.entityId;
      }

      const target = this.nodeIndex.get(targetId);
      if (!target) {
        return { success: false, error: `Target '${targetId}' not found for update-field` };
      }

      const targetType = target.type;
      let slug: string;
      let dirPath: string;

      if (targetType === 'idea') {
        slug = ideaIdToSlug(targetId);
        dirPath = path.join(this._researchDir, 'ideas', slug, 'README.md');
      } else if (targetType === 'experiment') {
        const expDir = await this.findExperimentDir(targetId);
        if (!expDir) return { success: false, error: `Experiment dir for '${targetId}' not found` };
        dirPath = path.join(expDir, 'README.md');
      } else {
        return { success: false, error: `Unsupported target type '${targetType}'` };
      }

      const raw = fs.readFileSync(dirPath, 'utf-8');
      const updated = updateFrontmatter(raw, action.updates as Record<string, unknown>);
      fs.writeFileSync(dirPath, updated, 'utf-8');

      const sideEffects = [`Updated fields on ${targetId}: ${Object.keys(action.updates).join(', ')}`];
      return { success: true, sideEffects };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  async createEntity(action: AutoCreateEntityAction, event: HookEvent): Promise<HookResult> {
    try {
      const vars = extractTemplateVariables(event);
      const content = renderTemplate(action.template, vars);

      if (action.entityType === 'log') {
        await this.addLog(content);
      }

      return { success: true, sideEffects: [`Created ${action.entityType} from hook`] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  async executeLogAction(action: AutoLogAction, event: HookEvent): Promise<HookResult> {
    try {
      const vars = extractTemplateVariables(event);
      const content = renderTemplate(action.template, vars);
      await this.addLog(content);
      return { success: true, sideEffects: ['Added log from hook'] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}

// ============ 工具函数 ============

function setNestedValue(obj: Record<string, unknown>, keyPath: string, value: unknown): void {
  const parts = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || typeof current[part] !== 'object' || Array.isArray(current[part])) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function parseConfigValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function jsonSchemaFromCustomField(fieldDef: { type: string; description?: string }): Record<string, unknown> {
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    integer: 'integer',
  };
  const schema: Record<string, unknown> = { type: typeMap[fieldDef.type] ?? 'string' };
  if (fieldDef.description) schema.description = fieldDef.description;
  return schema;
}

export default ResearchTracker;
