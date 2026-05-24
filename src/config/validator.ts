/**
 * Config v2 校验器
 *
 * 校验 config.yaml 的结构合法性和语义一致性。
 * 返回校验问题列表（error = 阻塞, warning = 提示）。
 */

import type { ProjectConfig, StatusFlowConfig } from '../types.js';

export interface ValidationIssue {
  level: 'error' | 'warning';
  path: string;
  message: string;
}

// ============ 内置状态枚举 ============

const IDEA_STATUSES = ['exploring', 'validated', 'refuted', 'parked', 'abandoned'];
const EXPERIMENT_STATUSES = ['planned', 'running', 'completed', 'failed', 'cancelled'];

// ============ 主校验函数 ============

/**
 * 校验配置的结构合法性和语义一致性。
 */
export function validateConfig(config: ProjectConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // version 校验
  if (!['1', '2'].includes(config.version)) {
    issues.push({
      level: 'error',
      path: 'version',
      message: `Invalid version "${config.version}". Must be "1" or "2".`,
    });
    return issues; // version 不合法，后续校验无意义
  }

  // version="1" 时不校验其他字段
  if (config.version === '1') {
    return issues;
  }

  // --- statusFlow ---
  if (config.statusFlow) {
    issues.push(...validateStatusFlow(config.statusFlow));
  }

  // --- metrics ---
  if (config.metrics) {
    issues.push(...validateMetrics(config.metrics));
  }

  // --- hooks ---
  if (config.hooks) {
    issues.push(...validateHooks(config));
  }

  // --- customFields ---
  if (config.customFields?.enabled && !config.customFields.schema) {
    issues.push({
      level: 'warning',
      path: 'customFields.schema',
      message: 'customFields is enabled but no schema is defined. All extra fields will be accepted without type checking.',
    });
  }

  // --- numbering ---
  if (config.numbering?.mode && !['global', 'per-idea'].includes(config.numbering.mode)) {
    issues.push({
      level: 'error',
      path: 'numbering.mode',
      message: `Invalid numbering mode "${config.numbering.mode}". Must be "global" or "per-idea".`,
    });
  }

  // --- output ---
  if (config.output?.defaultFormat && !['markdown', 'json', 'table'].includes(config.output.defaultFormat)) {
    issues.push({
      level: 'error',
      path: 'output.defaultFormat',
      message: `Invalid default format "${config.output.defaultFormat}". Must be "markdown", "json", or "table".`,
    });
  }

  return issues;
}

// ============ 子校验函数 ============

function validateStatusFlow(statusFlow: StatusFlowConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (statusFlow.idea) {
    issues.push(...validateEntityStatus('statusFlow.idea', statusFlow.idea, IDEA_STATUSES));
  }

  if (statusFlow.experiment) {
    issues.push(...validateEntityStatus('statusFlow.experiment', statusFlow.experiment, EXPERIMENT_STATUSES));
  }

  return issues;
}

function validateEntityStatus(
  path: string,
  config: { initial?: string; transitions?: Record<string, string[]> },
  knownStatuses: string[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // initial 必须是已知状态
  if (config.initial && !knownStatuses.includes(config.initial)) {
    issues.push({
      level: 'error',
      path: `${path}.initial`,
      message: `Unknown status "${config.initial}". Known statuses: ${knownStatuses.join(', ')}`,
    });
  }

  // transitions 中的状态引用检查
  if (config.transitions) {
    const allReferencedStatuses = new Set<string>();

    for (const [from, toList] of Object.entries(config.transitions)) {
      allReferencedStatuses.add(from);
      for (const to of toList) {
        allReferencedStatuses.add(to);
      }
    }

    for (const status of allReferencedStatuses) {
      if (!knownStatuses.includes(status)) {
        issues.push({
          level: 'warning',
          path: `${path}.transitions`,
          message: `Status "${status}" is not a built-in status. Known statuses: ${knownStatuses.join(', ')}. If this is intentional (custom status), you can ignore this warning.`,
        });
      }
    }

    // initial 必须在 transitions 的 key 中
    if (config.initial && !config.transitions[config.initial] && config.initial !== knownStatuses[knownStatuses.length - 1]) {
      // initial 不在 transitions 中且不是最后一个已知状态
      const hasKey = Object.keys(config.transitions).includes(config.initial);
      if (!hasKey) {
        issues.push({
          level: 'warning',
          path: `${path}.initial`,
          message: `Initial status "${config.initial}" is not listed in transitions. It will not be able to transition to any status.`,
        });
      }
    }
  }

  return issues;
}

function validateMetrics(metrics: { requiredKeys?: string[]; optionalKeys?: string[]; ranges?: Record<string, { min?: number; max?: number }> }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const allKeys = new Set([...(metrics.requiredKeys ?? []), ...(metrics.optionalKeys ?? [])]);

  // ranges 中引用的 key 应在 requiredKeys 或 optionalKeys 中
  if (metrics.ranges) {
    for (const key of Object.keys(metrics.ranges)) {
      if (!allKeys.has(key)) {
        issues.push({
          level: 'warning',
          path: `metrics.ranges.${key}`,
          message: `Range defined for "${key}" but it is not listed in requiredKeys or optionalKeys.`,
        });
      }
    }
  }

  return issues;
}

function validateHooks(config: ProjectConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const hooks = config.hooks!;

  // 校验 idea status change hooks
  if (hooks.onIdeaStatusChange) {
    for (let i = 0; i < hooks.onIdeaStatusChange.length; i++) {
      const rule = hooks.onIdeaStatusChange[i];
      const path = `hooks.onIdeaStatusChange[${i}]`;

      // 如果定义了 statusFlow.idea.transitions，检查 to 是否是合法目标
      if (config.statusFlow?.idea?.transitions) {
        const validTargets = new Set<string>();
        for (const toList of Object.values(config.statusFlow.idea.transitions)) {
          for (const t of toList) validTargets.add(t);
        }
        if (!validTargets.has(rule.to) && !IDEA_STATUSES.includes(rule.to)) {
          issues.push({
            level: 'warning',
            path: `${path}.to`,
            message: `Hook targets status "${rule.to}" which is not a valid transition target in statusFlow.idea.transitions.`,
          });
        }
      }
    }
  }

  // 校验 experiment status change hooks
  if (hooks.onExperimentStatusChange) {
    for (let i = 0; i < hooks.onExperimentStatusChange.length; i++) {
      const rule = hooks.onExperimentStatusChange[i];
      const path = `hooks.onExperimentStatusChange[${i}]`;

      if (config.statusFlow?.experiment?.transitions) {
        const validTargets = new Set<string>();
        for (const toList of Object.values(config.statusFlow.experiment.transitions)) {
          for (const t of toList) validTargets.add(t);
        }
        if (!validTargets.has(rule.to) && !EXPERIMENT_STATUSES.includes(rule.to)) {
          issues.push({
            level: 'warning',
            path: `${path}.to`,
            message: `Hook targets status "${rule.to}" which is not a valid transition target in statusFlow.experiment.transitions.`,
          });
        }
      }
    }
  }

  return issues;
}
