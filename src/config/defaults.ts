/**
 * Config v2 默认值合并
 *
 * 将用户配置与内置默认值深度合并，生成 ResolvedProjectConfig。
 * version="1" 时直接返回全默认值（等同于当前硬编码行为）。
 */

import type {
  ProjectConfig,
  ResolvedProjectConfig,
  StatusFlowConfig,
  EntityFieldsConfig,
  MetricsConfig,
  RelationsConfig,
  NumberingConfig,
  GitConfig,
  CustomFieldsConfig,
  OutputConfig,
  HooksConfig,
} from '../types.js';

// ============ 内置默认值 ============

const DEFAULT_STATUS_FLOW: StatusFlowConfig = {
  idea: {
    initial: 'exploring',
    // transitions 未设置 → 允许任意转换
  },
  experiment: {
    initial: 'planned',
    // transitions 未设置 → 允许任意转换
  },
};

const DEFAULT_FIELDS: EntityFieldsConfig = {
  idea: { required: [], defaults: {} },
  experiment: { required: [], defaults: {} },
  result: { required: [], defaults: {} },
  reference: { required: [], defaults: {} },
  log: { required: [], defaults: {} },
};

const DEFAULT_METRICS: MetricsConfig = {
  requiredKeys: [],
  optionalKeys: [],
  ranges: {},
};

const DEFAULT_RELATIONS: RelationsConfig = {
  idea: {
    builtIn: true,
    custom: [],
  },
};

const DEFAULT_NUMBERING: NumberingConfig = {
  mode: 'global',
};

const DEFAULT_GIT: GitConfig = {
  enabled: true,
  autoAttachCommitOnStatus: { running: true },
};

const DEFAULT_CUSTOM_FIELDS: CustomFieldsConfig = {
  enabled: false,
  schema: {},
};

const DEFAULT_OUTPUT: OutputConfig = {
  defaultFormat: 'markdown',
};

const DEFAULT_HOOKS: HooksConfig = {};

// ============ 深度合并工具 ============

function deepMerge<T>(target: T, source: unknown): T {
  const result = { ...target } as Record<string, unknown>;
  const src = source as Record<string, unknown> | undefined;
  if (!src) return result as T;
  for (const key of Object.keys(src)) {
    const val = src[key];
    if (val !== undefined && val !== null) {
      if (
        typeof val === 'object' &&
        !Array.isArray(val) &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key])
      ) {
        result[key] = deepMerge(result[key] as Record<string, unknown>, val);
      } else {
        result[key] = val;
      }
    }
  }
  return result as T;
}

// ============ 主函数 ============

/**
 * 将原始 ProjectConfig 与默认值合并，返回完整的 ResolvedProjectConfig。
 *
 * @param config - 从 config.yaml 解析的原始配置
 * @returns 合并默认值后的完整配置
 */
export function resolveConfig(config: ProjectConfig): ResolvedProjectConfig {
  // version="1" → 全部使用默认值
  if (config.version === '1') {
    return {
      version: '1',
      statusFlow: DEFAULT_STATUS_FLOW,
      fields: DEFAULT_FIELDS,
      metrics: DEFAULT_METRICS,
      relations: DEFAULT_RELATIONS,
      numbering: DEFAULT_NUMBERING,
      git: DEFAULT_GIT,
      customFields: DEFAULT_CUSTOM_FIELDS,
      output: DEFAULT_OUTPUT,
      hooks: DEFAULT_HOOKS,
    } as ResolvedProjectConfig;
  }

  return {
    version: config.version,
    statusFlow: deepMerge(DEFAULT_STATUS_FLOW, config.statusFlow) as unknown as Required<StatusFlowConfig>,
    fields: deepMerge(DEFAULT_FIELDS, config.fields) as EntityFieldsConfig,
    metrics: deepMerge(DEFAULT_METRICS, config.metrics) as MetricsConfig,
    relations: deepMerge(DEFAULT_RELATIONS, config.relations) as unknown as Required<RelationsConfig>,
    numbering: deepMerge(DEFAULT_NUMBERING, config.numbering) as unknown as Required<NumberingConfig>,
    git: deepMerge(DEFAULT_GIT, config.git) as unknown as Required<GitConfig>,
    customFields: deepMerge(DEFAULT_CUSTOM_FIELDS, config.customFields) as unknown as Required<CustomFieldsConfig>,
    output: deepMerge(DEFAULT_OUTPUT, config.output) as unknown as Required<OutputConfig>,
    hooks: config.hooks ?? DEFAULT_HOOKS,
  } as ResolvedProjectConfig;
}

/**
 * 获取默认配置（用于新项目初始化等场景）。
 */
export function getDefaultConfig(): ProjectConfig {
  return { version: '2' };
}
