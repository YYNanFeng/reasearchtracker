export interface BaseNode {
  id: string;
  type: string;
  tags?: string[];
  created: string;
  updated?: string;
}

export interface ProjectInfo {
  name: string;
  researchQuestion: string;
  status: 'active' | 'completed' | 'archived';
  created: string;
}

export type IdeaRelationType =
  | 'evolves_from'
  | 'inspired_by'
  | 'builds_on'
  | 'contradicts'
  | 'alternative_to'
  | 'refines';

export interface Idea extends BaseNode {
  type: 'idea';
  id: `idea-${string}`;
  status: 'exploring' | 'validated' | 'refuted' | 'parked' | 'abandoned';
  claim: string;
  evidence?: string;
  confidence?: number;
  parents?: Array<{
    id: string;
    relation: IdeaRelationType;
  }>;
  evidence_links?: Array<{
    result: string;
    verdict: 'supported' | 'partial' | 'refuted';
  }>;
}

export interface Experiment extends BaseNode {
  type: 'experiment';
  id: `exp-${number}-${string}`;
  idea: string;
  status: 'planned' | 'running' | 'completed' | 'failed' | 'cancelled';
  purpose?: string;
  based_on?: string;
  commits?: string[];
  tags?: string[];
}

export interface Result extends BaseNode {
  type: 'result';
  id: `result-${string}`;
  experiment: string;
  status: 'success' | 'failed';
  claim: string;
  evidence: string;
  metrics?: Record<string, number>;
}

export interface Reference {
  key: string;
  title: string;
  authors: string;
  year: number;
  venue?: string;
  url?: string;
  tags?: string[];
}

export interface LogEntry {
  type: 'log';
  date: string;
}

export interface Config {
  version: string;
}

// ============ Config v2 扩展类型 ============

export interface ProjectConfig {
  /** 配置版本号。"1" = 向后兼容（忽略所有 v2 配置），"2" = 启用全部配置能力 */
  version: string;
  statusFlow?: StatusFlowConfig;
  fields?: EntityFieldsConfig;
  metrics?: MetricsConfig;
  relations?: RelationsConfig;
  numbering?: NumberingConfig;
  git?: GitConfig;
  customFields?: CustomFieldsConfig;
  output?: OutputConfig;
  hooks?: HooksConfig;
}

// --- 状态流 ---

export interface StatusFlowConfig {
  idea?: EntityStatusConfig;
  experiment?: EntityStatusConfig;
}

export interface EntityStatusConfig {
  /** 初始状态。默认: idea→"exploring", experiment→"planned" */
  initial?: string;
  /**
   * 合法的状态转换规则。
   * key = 当前状态, value = 允许转换到的状态列表。
   * 未配置时允许任意转换。空数组 = 终态。
   */
  transitions?: Record<string, string[]>;
}

// --- 字段约束 ---

export interface EntityFieldsConfig {
  idea?: FieldRules;
  experiment?: FieldRules;
  result?: FieldRules;
  reference?: FieldRules;
  log?: FieldRules;
}

export interface FieldRules {
  /** 创建时必填的字段列表（追加到内置必填字段之上） */
  required?: string[];
  /** 字段默认值（创建时自动填充） */
  defaults?: Record<string, unknown>;
}

// --- Metrics ---

export interface MetricsConfig {
  /** 成功结果必须包含的 metric key 列表 */
  requiredKeys?: string[];
  /** 可选 metric key 列表（用于文档和提示，不强制） */
  optionalKeys?: string[];
  /** 各 metric key 的期望范围（校验时产生 warning） */
  ranges?: Record<string, { min?: number; max?: number }>;
}

// --- 关系类型 ---

export interface RelationsConfig {
  idea?: {
    /** 是否保留内置的 6 种关系类型。默认 true */
    builtIn?: boolean;
    /** 自定义关系类型列表（追加到内置类型之上） */
    custom?: string[];
  };
}

// --- 编号策略 ---

export interface NumberingConfig {
  /** 实验编号模式。"global" = 全局递增, "per-idea" = 每个 idea 独立递增 */
  mode?: 'global' | 'per-idea';
}

// --- Git ---

export interface GitConfig {
  /** 是否启用 Git 集成。默认 true */
  enabled?: boolean;
  /** 在特定状态变化时自动附加 HEAD commit。默认 { running: true } */
  autoAttachCommitOnStatus?: Record<string, boolean>;
}

// --- 自定义字段 ---

export interface CustomFieldsConfig {
  /** 是否允许在 frontmatter 中使用额外字段。默认 false */
  enabled?: boolean;
  /** 各实体类型允许的扩展字段及其类型定义 */
  schema?: {
    idea?: Record<string, { type: string; description?: string }>;
    experiment?: Record<string, { type: string; description?: string }>;
    result?: Record<string, { type: string; description?: string }>;
    reference?: Record<string, { type: string; description?: string }>;
  };
}

// --- 输出 ---

export interface OutputConfig {
  /** 默认输出格式。默认 "markdown" */
  defaultFormat?: 'markdown' | 'json' | 'table';
  /** 时区（影响日志时间戳显示）。默认系统时区 */
  timezone?: string;
}

// --- 钩子/自动化 ---

export interface HooksConfig {
  onIdeaStatusChange?: StatusChangeRule[];
  onExperimentStatusChange?: StatusChangeRule[];
  onResultCreated?: ResultCreatedRule[];
}

export type HookTiming = 'before' | 'after';

export interface StatusChangeRule {
  /** 匹配的目标状态 */
  to: string;
  /** 执行时机。before = 事前校验（可阻止操作），after = 事后触发。默认 after */
  timing?: HookTiming;
  /** 触发的动作列表 */
  actions: Action[];
}

export interface ResultCreatedRule {
  /** 匹配条件 */
  condition?: {
    status?: string;
  };
  /** 触发的动作列表 */
  actions: Action[];
}

export type Action =
  | AutoUpdateFieldAction
  | AutoCreateEntityAction
  | AutoLogAction;

/** 自动更新字段 */
export interface AutoUpdateFieldAction {
  type: 'update-field';
  /** 目标实体类型 */
  target: 'idea' | 'experiment';
  /** 目标实体定位方式 */
  locateBy: 'self' | 'parent' | 'related';
  /** 要更新的字段和值 */
  updates: Record<string, unknown>;
}

/** 自动创建实体 */
export interface AutoCreateEntityAction {
  type: 'create-entity';
  entityType: 'log';
  /** 内容模板（支持 {{id}}, {{status}} 等变量替换） */
  template: string;
}

/** 自动记录日志 */
export interface AutoLogAction {
  type: 'add-log';
  /** 日志内容模板 */
  template: string;
}

/** Hook 事件上下文（传递给 hooks 引擎） */
export interface HookEvent {
  eventType: 'idea_status_change' | 'experiment_status_change' | 'result_created';
  entityId: string;
  entityType: 'idea' | 'experiment';
  fromStatus?: string;
  toStatus?: string;
  parentIdeaId?: string;
  experimentId?: string;
  resultStatus?: string;
}

/** 合并默认值后的完整配置（运行时使用） */
export interface ResolvedProjectConfig extends Required<ProjectConfig> {
  statusFlow: Required<StatusFlowConfig>;
  fields: EntityFieldsConfig;
  metrics: MetricsConfig;
  relations: Required<RelationsConfig>;
  numbering: Required<NumberingConfig>;
  git: Required<GitConfig>;
  customFields: Required<CustomFieldsConfig>;
  output: Required<OutputConfig>;
  hooks: HooksConfig;
}

export interface State {
  active?: {
    idea?: string;
    experiment?: string;
  };
  last_session?: {
    active_at: string;
    summary: string;
  };
}

export interface IdeaInput {
  title: string;
  claim: string;
  evidence?: string;
  parents?: string;
  confidence?: number;
  tags?: string;
  body?: string;
  extra?: Record<string, unknown>;
}

export interface ExperimentInput {
  title: string;
  idea: string;
  purpose?: string;
  based_on?: string;
  commits?: string;
  tags?: string;
  body?: string;
  extra?: Record<string, unknown>;
}

export interface ResultInput {
  experiment_id: string;
  claim: string;
  evidence: string;
  status: 'success' | 'failed';
  metrics?: string;
  body?: string;
  extra?: Record<string, unknown>;
}

export interface ReferenceInput {
  key: string;
  title: string;
  authors: string;
  year: number;
  venue?: string;
  url?: string;
  tags?: string;
  body?: string;
}

export interface IdeaFilter {
  status?: string;
}

export interface ExperimentFilter {
  idea?: string;
  status?: string;
  tags?: string;
}

export interface TimelineFilter {
  from?: string;
  to?: string;
}

export interface SearchResult {
  id: string;
  type: string;
  snippet: string;
}

export interface TimelineEntry {
  date: string;
  type: 'log' | 'git' | 'idea' | 'experiment' | 'result';
  content: string;
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  file: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface MarkdownFile {
  data: Record<string, unknown>;
  content: string;
  path: string;
}

export type NodeMap = Map<string, BaseNode>;
export type TypeIndex = Map<string, Set<string>>;
