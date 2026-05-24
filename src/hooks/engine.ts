/**
 * Hooks 引擎
 *
 * 负责执行 config.hooks 中定义的自动化规则。
 * 支持 before（事前校验，可阻止操作）和 after（事后触发）两种时机。
 */

import type {
  HooksConfig,
  StatusChangeRule,
  ResultCreatedRule,
  Action,
  HookEvent,
  AutoUpdateFieldAction,
  AutoCreateEntityAction,
  AutoLogAction,
} from '../types.js';

// ============ 类型定义 ============

export interface HookResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息（before hook 失败时用于拒绝操作） */
  error?: string;
  /** 产生的副作用描述（用于日志） */
  sideEffects?: string[];
}

type TemplateVariables = Record<string, string>;

// ============ 主引擎类 ============

export class HooksEngine {
  private hooks: HooksConfig;
  private executor: HookActionExecutor;

  constructor(hooks: HooksConfig, executor: HookActionExecutor) {
    this.hooks = hooks;
    this.executor = executor;
  }

  /**
   * 执行 before hooks。
   * 如果任一 hook 返回失败，应阻止操作。
   */
  async executeBefore(event: HookEvent): Promise<HookResult> {
    const rules = this.getMatchingRules(event, 'before');
    const sideEffects: string[] = [];

    for (const rule of rules) {
      for (const action of rule.actions) {
        const result = await this.executeAction(action, event);
        if (!result.success) {
          return {
            success: false,
            error: result.error ?? `Hook action failed for event ${event.entityId}`,
          };
        }
        if (result.sideEffects) {
          sideEffects.push(...result.sideEffects);
        }
      }
    }

    return { success: true, sideEffects };
  }

  /**
   * 执行 after hooks。
   * 操作已成功完成，hook 失败不回滚。
   */
  async executeAfter(event: HookEvent): Promise<HookResult> {
    const rules = this.getMatchingRules(event, 'after');
    const sideEffects: string[] = [];
    const errors: string[] = [];

    for (const rule of rules) {
      for (const action of rule.actions) {
        const result = await this.executeAction(action, event);
        if (!result.success) {
          // after hook 失败不阻塞，记录错误
          errors.push(result.error ?? 'Unknown hook error');
        }
        if (result.sideEffects) {
          sideEffects.push(...result.sideEffects);
        }
      }
    }

    return {
      success: true,
      sideEffects,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  async executeResultCreated(event: HookEvent): Promise<HookResult> {
    const rules = this.hooks.onResultCreated ?? [];
    const sideEffects: string[] = [];
    const errors: string[] = [];

    const matchingRules = rules.filter(rule => {
      if (rule.condition?.status && rule.condition.status !== event.resultStatus) return false;
      return true;
    });

    for (const rule of matchingRules) {
      for (const action of rule.actions) {
        const result = await this.executeAction(action, event);
        if (!result.success) {
          errors.push(result.error ?? 'Unknown hook error');
        }
        if (result.sideEffects) {
          sideEffects.push(...result.sideEffects);
        }
      }
    }

    return {
      success: true,
      sideEffects,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  // ============ 内部方法 ============

  private getMatchingRules(event: HookEvent, timing: 'before' | 'after'): StatusChangeRule[] {
    let rules: StatusChangeRule[] = [];

    switch (event.eventType) {
      case 'idea_status_change':
        rules = this.hooks.onIdeaStatusChange ?? [];
        break;
      case 'experiment_status_change':
        rules = this.hooks.onExperimentStatusChange ?? [];
        break;
      case 'result_created':
        // result_created 没有 timing 概念，只有 after
        return [];
    }

    return rules.filter(rule => {
      if (rule.to !== event.toStatus) return false;
      const ruleTiming = rule.timing ?? 'after';
      return ruleTiming === timing;
    });
  }

  private async executeAction(action: Action, event: HookEvent): Promise<HookResult> {
    switch (action.type) {
      case 'update-field':
        return this.executor.updateField(action, event);
      case 'create-entity':
        return this.executor.createEntity(action, event);
      case 'add-log':
        return this.executor.executeLogAction(action, event);
      default:
        return { success: false, error: `Unknown action type: ${(action as Action).type}` };
    }
  }
}

// ============ 执行器接口 ============

/**
 * Hook 动作执行器接口。
 * 由 ResearchTracker 类实现，以访问数据操作方法。
 */
export interface HookActionExecutor {
  updateField(action: AutoUpdateFieldAction, event: HookEvent): Promise<HookResult>;
  createEntity(action: AutoCreateEntityAction, event: HookEvent): Promise<HookResult>;
  executeLogAction(action: AutoLogAction, event: HookEvent): Promise<HookResult>;
}

// ============ 模板变量替换 ============

/**
 * 从 HookEvent 中提取模板变量。
 */
export function extractTemplateVariables(event: HookEvent): TemplateVariables {
  const now = new Date();
  const vars: TemplateVariables = {
    id: event.entityId,
    type: event.entityType,
    status: event.toStatus ?? '',
    from: event.fromStatus ?? '',
    to: event.toStatus ?? '',
    date: now.toISOString().slice(0, 10),
    time: now.toISOString().slice(11, 16),
  };

  if (event.parentIdeaId) {
    vars.idea = event.parentIdeaId;
  }
  if (event.experimentId) {
    vars.experiment = event.experimentId;
  }

  return vars;
}

/**
 * 简单模板变量替换：将 {{key}} 替换为对应值。
 */
export function renderTemplate(template: string, variables: TemplateVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return variables[key] ?? match;
  });
}
