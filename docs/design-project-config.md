# 项目级 Config 设计文档

> 状态：**Confirmed v1** | 目标版本：config version "2"

## 一、设计目标

1. **向后兼容**：`version: "1"` 的项目零改动继续工作，所有新配置项有合理默认值（= 当前硬编码行为）
2. **渐进式复杂度**：简单项目只填 `version`，复杂项目逐步添加约束
3. **双消费者**：YAML 人类可写，同时可被 AI Agent 通过 MCP 工具读取和校验
4. **单一真相源**：config.yaml 是项目级配置的唯一来源，CLI / API / MCP 全部从中读取

---

## 二、Config 数据模型

### 2.1 完整 TypeScript 类型

```typescript
// ============================================================
// 核心配置类型（存储在 .research/config.yaml）
// ============================================================

interface ProjectConfig {
  /** 配置版本号。值为 "1" 时使用全部默认行为（向后兼容） */
  version: string;

  // ──────────── 状态流 ────────────

  /** 状态转换规则。未配置时使用内置默认规则 */
  statusFlow?: StatusFlowConfig;

  // ──────────── 字段约束 ────────────

  /** 各实体类型的字段约束 */
  fields?: EntityFieldsConfig;

  // ──────────── Metrics ────────────

  /** Metrics 指标约束（影响 result 和 compare） */
  metrics?: MetricsConfig;

  // ──────────── 关系类型 ────────────

  /** 自定义关系类型 */
  relations?: RelationsConfig;

  // ──────────── 编号策略 ────────────

  /** 实验编号方式 */
  numbering?: NumberingConfig;

  // ──────────── Git 集成 ────────────

  /** Git 功能开关 */
  git?: GitConfig;

  // ──────────── 自定义字段 ────────────

  /** 允许在 frontmatter 中使用的扩展字段定义 */
  customFields?: CustomFieldsConfig;

  // ──────────── 输出 ────────────

  /** 输出格式默认值 */
  output?: OutputConfig;

  // ──────────── 钩子/自动化 ────────────

  /** 工作流自动化钩子 */
  hooks?: HooksConfig;
}

// ============================================================
// 状态流
// ============================================================

interface StatusFlowConfig {
  /** idea 状态配置 */
  idea?: EntityStatusConfig;
  /** experiment 状态配置 */
  experiment?: EntityStatusConfig;
}

interface EntityStatusConfig {
  /** 初始状态（创建新实体时的默认状态）。默认: idea→"exploring", experiment→"planned" */
  initial?: string;
  /**
   * 合法的状态转换规则。
   * key = 当前状态, value = 允许转换到的状态列表。
   * 未配置时允许任意转换（当前行为）。
   * 空数组表示该状态为终态，不可再转换。
   */
  transitions?: Record<string, string[]>;
}

// ============================================================
// 字段约束
// ============================================================

interface EntityFieldsConfig {
  idea?: FieldRules;
  experiment?: FieldRules;
  result?: FieldRules;
  reference?: FieldRules;
  log?: FieldRules;
}

interface FieldRules {
  /** 创建时必填的字段列表（追加到内置必填字段之上） */
  required?: string[];
  /** 字段默认值（创建时自动填充） */
  defaults?: Record<string, unknown>;
}

// ============================================================
// Metrics
// ============================================================

interface MetricsConfig {
  /**
   * 成功结果必须包含的 metric key 列表。
   * 未配置时只要求 metrics 非空（当前行为）。
   * 配置后，logResult 会校验每个 required key 是否存在。
   */
  requiredKeys?: string[];
  /**
   * 可选 metric key 列表（用于文档和提示，不做强制校验）。
   * AI Agent 可据此知道该项目关注哪些指标。
   */
  optionalKeys?: string[];
  /**
   * 各 metric key 的期望范围。
   * 校验时产生 warning（不阻塞写入），帮助发现异常数据。
   */
  ranges?: Record<string, { min?: number; max?: number }>;
}

// ============================================================
// 关系类型
// ============================================================

interface RelationsConfig {
  /**
   * idea 关系类型配置
   */
  idea?: {
    /** 是否保留内置的 6 种关系类型。默认 true */
    builtIn?: boolean;
    /** 自定义关系类型列表（追加到内置类型之上） */
    custom?: string[];
  };
}

// ============================================================
// 编号策略
// ============================================================

interface NumberingConfig {
  /**
   * 实验编号模式：
   * - "global"（默认）：全局递增，所有 idea 共享序号（当前行为）
   * - "per-idea"：每个 idea 独立递增序号
   */
  mode?: 'global' | 'per-idea';
}

// ============================================================
// Git
// ============================================================

interface GitConfig {
  /** 是否启用 Git 集成。默认 true */
  enabled?: boolean;
  /**
   * 在特定状态变化时自动附加 HEAD commit。
   * key = 目标状态, value = 是否自动附加。
   * 默认: { running: true }（当前行为）
   */
  autoAttachCommitOnStatus?: Record<string, boolean>;
}

// ============================================================
// 自定义字段
// ============================================================

interface CustomFieldsConfig {
  /**
   * 是否允许在 frontmatter 中使用额外字段。
   * false（默认）: JSON Schema 的 additionalProperties: false（当前行为）
   * true: additionalProperties: true，但可以用 schema 进一步约束类型
   */
  enabled?: boolean;
  /**
   * 各实体类型允许的扩展字段及其 JSON Schema 类型定义。
   * 仅当 enabled=true 时生效。
   */
  schema?: {
    idea?: Record<string, { type: string; description?: string }>;
    experiment?: Record<string, { type: string; description?: string }>;
    result?: Record<string, { type: string; description?: string }>;
    reference?: Record<string, { type: string; description?: string }>;
  };
}

// ============================================================
// 输出
// ============================================================

interface OutputConfig {
  /** 默认输出格式。默认 "markdown" */
  defaultFormat?: 'markdown' | 'json' | 'table';
  /** 时区（影响日志时间戳显示）。默认系统时区 */
  timezone?: string;
}

// ============================================================
// 钩子 / 自动化
// ============================================================

interface HooksConfig {
  /** idea 状态变化时触发的规则 */
  onIdeaStatusChange?: StatusChangeRule[];
  /** experiment 状态变化时触发的规则 */
  onExperimentStatusChange?: StatusChangeRule[];
  /** result 创建时触发的规则 */
  onResultCreated?: ResultCreatedRule[];
}

/** 通用状态变化触发规则 */
interface StatusChangeRule {
  /** 匹配的目标状态 */
  to: string;
  /** 触发的动作列表 */
  actions: Action[];
}

/** result 创建触发规则 */
interface ResultCreatedRule {
  /** 匹配条件 */
  condition?: {
    /** 结果状态 */
    status?: string;
  };
  /** 触发的动作列表 */
  actions: Action[];
}

/** 动作定义 */
type Action =
  | AutoUpdateFieldAction
  | AutoCreateEntityAction
  | AutoLogAction;

/** 自动更新字段 */
interface AutoUpdateFieldAction {
  type: 'update-field';
  /** 目标实体类型 */
  target: 'idea' | 'experiment';
  /**
   * 目标实体定位方式：
   * - "self": 状态变化的实体自身
   * - "parent": 父实体（experiment→其所属idea）
   * - "related": 关联实体（通过 ID 引用）
   */
  locateBy: 'self' | 'parent' | 'related';
  /** 要更新的字段和值 */
  updates: Record<string, unknown>;
}

/** 自动创建实体 */
interface AutoCreateEntityAction {
  type: 'create-entity';
  /** 要创建的实体类型 */
  entityType: 'log';
  /** 内容模板（支持变量替换） */
  template: string;
}

/** 自动记录日志 */
interface AutoLogAction {
  type: 'add-log';
  /** 日志内容模板 */
  template: string;
}
```

---

## 三、默认值与向后兼容

### 3.1 默认值表

当 `config.yaml` 中某个 section 缺失时，等效于以下默认值：

```yaml
# 以下为 version: "2" 的完整默认值（= 当前硬编码行为）
statusFlow:
  idea:
    initial: "exploring"
    # transitions 未设置 → 允许任意状态转换
  experiment:
    initial: "planned"
    # transitions 未设置 → 允许任意状态转换

fields:
  idea:
    required: []          # 内置必填 claim 不可移除
    defaults: {}
  experiment:
    required: []          # 内置必填 idea,title 不可移除
    defaults: {}
  result:
    required: []          # 内置必填 claim,evidence,status 不可移除
    defaults: {}
  reference:
    required: []          # 内置必填 key,title,authors,year 不可移除
    defaults: {}

metrics:
  requiredKeys: []        # 仅要求 metrics 非空
  optionalKeys: []
  ranges: {}

relations:
  idea:
    builtIn: true
    custom: []

numbering:
  mode: "global"

git:
  enabled: true
  autoAttachCommitOnStatus:
    running: true

customFields:
  enabled: false

output:
  defaultFormat: "markdown"

hooks: []                 # 无钩子
```

### 3.2 version 兼容规则

| config.yaml version | 行为 |
|---------------------|------|
| `"1"` 或缺失 | 完全等同于当前行为，忽略所有新增配置项 |
| `"2"` | 启用所有 v2 配置能力，缺失项使用默认值 |

---

## 四、config.yaml 示例

### 4.1 最小配置（向后兼容）

```yaml
version: "1"
```

### 4.2 中等配置：约束状态流 + Metrics

```yaml
version: "2"

statusFlow:
  idea:
    initial: "exploring"
    transitions:
      exploring: ["validated", "refuted", "parked", "abandoned"]
      validated: ["exploring", "parked", "abandoned"]
      refuted: ["exploring", "abandoned"]
      parked: ["exploring", "abandoned"]
      abandoned: []                    # 终态
  experiment:
    initial: "planned"
    transitions:
      planned: ["running", "cancelled"]
      running: ["completed", "failed", "cancelled"]
      completed: []                    # 终态
      failed: ["planned"]              # 允许重试
      cancelled: []                    # 终态

metrics:
  requiredKeys: ["mAP", "recall"]
  optionalKeys: ["fps", "params", "flops"]
  ranges:
    mAP: { min: 0, max: 1 }
    recall: { min: 0, max: 1 }
    fps: { min: 0 }

fields:
  idea:
    required: ["evidence"]             # 在此项目中 evidence 也必填
    defaults:
      confidence: 0.5
  experiment:
    required: ["purpose"]              # 在此项目中 purpose 也必填
```

### 4.3 高级配置：自定义字段 + 钩子

```yaml
version: "2"

customFields:
  enabled: true
  schema:
    experiment:
      dataset: { type: "string", description: "训练使用的数据集" }
      model: { type: "string", description: "模型架构" }
      gpu: { type: "string", description: "使用的 GPU 型号" }
      training_hours: { type: "number", description: "训练时长（小时）" }
    result:
      epoch: { type: "number", description: "最佳 epoch" }
      batch_size: { type: "number", description: "批次大小" }
    idea:
      difficulty: { type: "string", description: "实现难度: low/medium/high" }
      priority: { type: "string", description: "优先级: P0/P1/P2/P3" }

hooks:
  onExperimentStatusChange:
    - to: "completed"
      actions:
        - type: "add-log"
          template: "✅ 实验 {{id}} 完成"
    - to: "failed"
      actions:
        - type: "add-log"
          template: "❌ 实验 {{id}} 失败"
  onResultCreated:
    - condition:
        status: "success"
      actions:
        - type: "update-field"
          target: "idea"
          locateBy: "parent"
          updates:
            # 不支持自动 confidence 计算，但支持 evidence_link 追加
            # 这里演示标记 idea 需要重新评估
            _needsReview: true

relations:
  idea:
    builtIn: true
    custom: ["decomposes_from", "generalizes"]

numbering:
  mode: "per-idea"
```

---

## 五、核心 API 变更

### 5.1 ResearchTracker 类变更

```typescript
class ResearchTracker {
  // ──── 新增/变更的方法 ────

  /**
   * 获取解析后的完整配置（合并默认值）。
   * version="1" 时返回默认配置。
   */
  async getResolvedConfig(): Promise<ResolvedProjectConfig>;

  /**
   * 校验状态转换是否合法。
   * @throws Error 如果转换不合法
   */
  async validateStatusTransition(
    entityType: 'idea' | 'experiment',
    fromStatus: string,
    toStatus: string,
  ): Promise<void>;

  /**
   * 校验 metrics 是否满足约束。
   * @returns warnings 数组（不阻塞）
   */
  async validateMetrics(
    metrics: Record<string, number>,
  ): Promise<string[]>;

  /**
   * 执行钩子（内部方法，状态变化后自动调用）。
   */
  private async executeHooks(
    event: HookEvent,
  ): Promise<void>;

  // ──── 变更的方法签名 ────

  /**
   * getConfig: 返回原始 YAML 解析结果（不合并默认值）
   */
  async getConfig(): Promise<ProjectConfig>;

  /**
   * setConfig: 支持嵌套 key 路径（如 "statusFlow.idea.initial"）
   */
  async setConfig(key: string, value: unknown): Promise<void>;

  /**
   * validate: 增加配置校验 + 状态流校验 + 自定义字段校验
   */
  async validate(): Promise<ValidationResult>;
}
```

### 5.2 行为变更点

| 操作 | 当前行为 | v2 行为（受 config 影响） |
|------|---------|------------------------|
| `addIdea` | status 硬编码为 `"exploring"` | 读取 `statusFlow.idea.initial` |
| `addIdea` | 无额外必填字段 | 合并 `fields.idea.required` 检查 |
| `addIdea` | 无默认值填充 | 合并 `fields.idea.defaults` 填充 |
| `createExperiment` | status 硬编码为 `"planned"` | 读取 `statusFlow.experiment.initial` |
| `updateIdea(id, {status})` | 允许任意状态转换 | 校验 `statusFlow.idea.transitions` |
| `updateExperiment(id, {status})` | 允许任意状态转换 + 自动获取 HEAD commit | 校验 transitions + 检查 git.enabled |
| `logResult` | success 时只检查 metrics 非空 | 额外检查 `metrics.requiredKeys` |
| `logResult` | 无范围校验 | 检查 `metrics.ranges`，产生 warning |
| `validate` | JSON Schema 校验 | + 配置 schema 校验 + 状态流合法性 + 自定义字段类型 |
| `createExperiment` | 全局递增序号 | 根据 `numbering.mode` 决定 |
| 所有创建操作 | `additionalProperties: false` | `customFields.enabled` 时放宽 |
| 状态变化 | 无后续动作 | 执行 `hooks` 中匹配的规则 |

---

## 六、MCP 工具变更

### 6.1 新增工具

| 工具名 | 功能 | 参数 |
|--------|------|------|
| `research_get_config` | 获取完整配置（含默认值） | `{ resolved?: boolean }` |
| `research_set_config` | 设置配置项 | `{ key: string, value: any }` |
| `research_validate_config` | 单独校验配置合法性 | `{}` |

### 6.2 现有工具变更

**research_add_idea**:
- description 中动态包含 `statusFlow.idea.initial` 的值
- 校验 `fields.idea.required` 中的额外字段
- 执行 `hooks.onIdeaStatusChange`（创建视为 initial 状态变化）

**research_update_idea**:
- description 中动态包含合法的目标状态列表（来自 transitions）
- 调用前校验 `validateStatusTransition`
- 校验通过后执行更新，然后触发 hooks

**research_create_experiment**:
- 同理，校验 fields + hooks

**research_update_experiment**:
- 同理，校验 transitions + hooks

**research_log_result**:
- 校验 `metrics.requiredKeys`
- 触发 `hooks.onResultCreated`

---

## 七、CLI 变更

### 7.1 config 子命令增强

```bash
# 查看完整配置（含默认值）
research config list [--resolved]

# 获取单个配置项（支持嵌套路径）
research config get <key>
# 例: research config get statusFlow.idea.initial
# → "exploring"

# 设置配置项
research config set <key> <value>
# 例: research config set statusFlow.idea.transitions.exploring '["validated","refuted"]'

# 校验配置
research config validate
```

### 7.2 init 命令增强

```bash
research init --name <name> --question <question>
# 生成 config.yaml 时：
#   - version 默认 "2"（新项目推荐）
#   - 内置其他默认值
#   - 可交互式询问是否启用状态流约束等
```

### 7.3 状态命令反馈

当状态转换被拒绝时：

```bash
$ research idea update idea-xxx --status validated
❌ Invalid status transition: exploring → validated
   Allowed transitions from 'exploring': validated, refuted, parked, abandoned
   Hint: Check statusFlow.idea.transitions in config.yaml
```

---

## 八、配置校验

### 8.1 Config 自身的 JSON Schema

新增 `src/schemas/config.json`，用于校验 `config.yaml` 的结构合法性：

- version 必须是 `"1"` 或 `"2"`
- statusFlow.transitions 中的状态值必须是合法枚举
- metrics.requiredKeys 必须是字符串数组
- hooks 中的 template 必须是字符串
- etc.

### 8.2 运行时校验逻辑

```typescript
class ConfigValidator {
  /**
   * 校验配置的结构合法性和语义一致性。
   * 例如：
   * - statusFlow.transitions 中引用的状态必须是已定义的状态
   * - hooks 中引用的 entityType 必须合法
   * - metrics.ranges 中引用的 key 应在 requiredKeys 或 optionalKeys 中
   */
  validate(config: ProjectConfig): ValidationIssue[];
}
```

---

## 九、实现计划

### Phase 1: 基础设施（预估 1-2 天）

1. **扩展类型定义** — `types.ts` 中新增所有 config 相关类型
2. **config schema** — 新增 `src/schemas/config.json`
3. **默认值合并** — 新增 `src/config/defaults.ts`，提供 `resolveConfig()` 函数
4. **config 校验** — 新增 `src/config/validator.ts`

### Phase 2: 核心消费（预估 2-3 天）

5. **状态流校验** — `updateIdea` / `updateExperiment` 中集成 transitions 校验
6. **字段约束** — `addIdea` / `createExperiment` 中集成 required + defaults
7. **Metrics 约束** — `logResult` 中集成 requiredKeys + ranges
8. **编号策略** — `createExperiment` 中集成 per-idea 模式
9. **自定义字段** — JSON Schema 动态生成（根据 customFields 配置）
10. **Git 开关** — 条件化 git 操作

### Phase 3: 自动化（预估 1-2 天）

11. **Hooks 引擎** — 新增 `src/hooks/engine.ts`，实现动作执行
12. **内置动作** — update-field / create-entity / add-log
13. **模板变量** — 支持 `{{id}}`, `{{status}}`, `{{from}}`, `{{to}}` 等

### Phase 4: 接口层（预估 1-2 天）

14. **MCP 工具更新** — 新增 3 个 config 工具 + 更新现有工具的 description
15. **CLI 命令更新** — config 子命令增强
16. **validate 增强** — 集成配置校验

### Phase 5: 测试 + 文档（预估 1 天）

17. **单元测试** — 每个新功能模块
18. **集成测试** — 端到端场景
19. **CLAUDE.md 更新** — 更新 AI 编码指南
20. **README 更新** — 用户文档

---

## 十、已决议的设计决策

### Q1: Hooks 动作支持「阻塞型」✅ 已决定：支持 pre-action hook

Hooks 同时支持 pre-action（事前校验，可阻止操作）和 post-action（事后触发）。

**Pre-action hook**：
- 在状态转换**之前**执行
- 如果 pre-action 返回错误，**阻止操作**并返回错误信息
- 用途：自定义校验逻辑（如 "idea 必须至少有 1 个成功实验才能标记为 validated"）

```typescript
/** 钩子执行时机 */
type HookTiming = 'before' | 'after';

interface StatusChangeRule {
  /** 匹配的目标状态 */
  to: string;
  /** 执行时机：before=事前校验（可阻止），after=事后触发 */
  timing?: HookTiming; // 默认 'after'
  /** 触发的动作列表 */
  actions: Action[];
}
```

**执行顺序**：所有 `timing: 'before'` 的 hooks 先执行 → 任一失败则拒绝操作 → 执行实际状态变更 → 执行所有 `timing: 'after'` 的 hooks。

### Q2: 自定义字段在 CLI 中的传递方式 ✅ 已决定：方案 A

使用 `--extra key=value` 可多次使用：

```bash
research experiment create baseline --idea idea-xxx \
  --extra dataset=COCO --extra model=YOLOv8 --extra training_hours=2.5
```

- `--extra` 可多次使用
- 值自动按 customFields.schema 中的 type 做类型转换（string → number 等）
- schema 中未定义的 extra 字段被拒绝（防止拼写错误）

### Q3: config 是否支持「继承」或「profile」✅ 已决定：v2 不做

不做 profile 机制。理由：
- config.yaml 入 Git，不同阶段可通过 Git branch/tag 管理
- 保持单一配置文件，降低复杂度

### Q4: hooks 中的 template 变量支持程度 ✅ 已决定：简单变量替换

只做 `{{variable}}` 形式的简单替换，不支持条件逻辑。

**支持的变量**：

| 变量 | 含义 | 可用场景 |
|------|------|---------|
| `{{id}}` | 实体 ID | 所有 hooks |
| `{{type}}` | 实体类型 (idea/experiment) | 所有 hooks |
| `{{status}}` | 变更后的状态 | onStatusChange |
| `{{from}}` | 变更前的状态 | onStatusChange |
| `{{to}}` | 变更后的状态 (=status) | onStatusChange |
| `{{idea}}` | 所属 idea ID | onExperimentStatusChange, onResultCreated |
| `{{experiment}}` | 所属 experiment ID | onResultCreated |
| `{{date}}` | 当前日期 YYYY-MM-DD | 所有 hooks |
| `{{time}}` | 当前时间 HH:MM | 所有 hooks |

复杂自动化需求建议通过外部脚本 + MCP 实现。

---

## 附录：配置对 AI Agent 的影响

配置对 AI Agent（通过 MCP 使用）的核心价值：

1. **行为边界约束** — statusFlow 限制 Agent 不能做非法状态转换，防止 Agent 误操作
2. **上下文感知** — `research_get_config` 让 Agent 了解项目约定（metrics 名、自定义字段等）
3. **字段提示** — MCP tool description 动态包含必填字段和合法状态，减少 Agent 犯错
4. **自动化协作** — hooks 让 Agent 的操作自动产生日志等副作用，保持记录完整性

示例 MCP 交互流程：
```
Agent → research_get_config({ resolved: true })
←  { statusFlow: { experiment: { transitions: { planned: ["running","cancelled"] } } },
      metrics: { requiredKeys: ["mAP"] } }

Agent → research_update_experiment({ id: "exp-001-xxx", status: "running" })
←  ✅ (transitions.planned 包含 "running")

Agent → research_update_experiment({ id: "exp-001-xxx", status: "completed" })
←  ❌ Invalid transition: running → completed (当前 running 允许转到 completed，仅作示例)
```
