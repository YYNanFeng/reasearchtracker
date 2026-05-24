# ResearchTracker

> 面向深度学习研究者的科研过程管理工具

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/@nanfen/researchtracker.svg)](https://www.npmjs.com/package/@nanfen/researchtracker)

ResearchTracker 帮助研究者记录从 **思路 → 实验 → 代码 → 结果** 的完整科研链路，以零摩擦的方式管理科研全过程。

## ✨ 核心特性

- 📝 **Markdown 驱动** — 所有数据存储为 Markdown + YAML Frontmatter，人可读、Git 可追踪
- 🧠 **知识图谱** — 思路间关系、证据链、实验继承，构建研究知识图谱
- 🖥️ **CLI + MCP Server** — 命令行工具，同时支持 AI Agent 通过 MCP 协议接入
- ⚙️ **灵活配置** — 状态流、字段约束、Hooks 自动化，按项目定制工作流
- 🔗 **Git 集成** — 自动锚定 commit hash，构建代码-实验关联

## 🚀 快速上手

### 安装

```bash
# 从 npm 安装（推荐）
npm install -g @nanfen/researchtracker

# 或使用 npx 免安装运行
npx @nanfen/researchtracker --help
```

<details>
<summary>从源码安装</summary>

```bash
git clone https://github.com/YYNanFeng/reasearchtracker.git
cd reasearchtracker
npm install
npm run build
npm link
```

</details>

### 初始化研究项目

```bash
cd your-research-project
research init --name "我的研究" --question "如何提升模型精度？"
```

这会在项目中创建 `.research/` 目录：

```
your-research-project/
└── .research/
    ├── README.md        # 项目信息
    ├── config.yaml      # 项目配置（入 Git）
    ├── state.yaml       # 运行时状态（不入 Git）
    ├── ideas/           # 思路目录
    ├── refs/            # 文献目录
    └── logs/            # 日志目录
```

### 基本工作流

```bash
# 添加研究思路
research idea add "使用注意力机制" --claim "注意力机制可以提升特征提取"

# 创建实验
research experiment create "baseline" --idea idea-使用注意力机制

# 开始实验（自动锚定 git commit）
research experiment update exp-001-baseline --status running

# 记录结果
research experiment log-result exp-001-baseline \
  --claim "精度提升2%" \
  --evidence "准确率从85%提升到87%" \
  --status success \
  --metrics '{"accuracy": 0.87}'

# 查看研究状态
research status

# 对比实验
research compare exp-001-baseline exp-002-改进版
```

### MCP Server（AI Agent 接入）

```bash
research serve --mcp
```

支持 Cursor、Claude Desktop 等 AI 工具通过 MCP 协议直接操作研究数据。

## 📐 数据模型

```
项目 (Project) → 思路 (Idea) → 实验 (Experiment) → 结果 (Result)
       ↓                ↓               ↓
   文献 (Reference)  思路间关系         commit hash
                    (parents 边)       (commits 字段)
```

### 思路间关系

`evolves_from` | `inspired_by` | `builds_on` | `contradicts` | `alternative_to` | `refines`

### 证据链

Idea 可通过 `evidence_links` 关联到 Result，标注 verdict：
- `supported` — 实验支持该思路
- `partial` — 部分支持
- `refuted` — 实验反驳该思路

## ⚙️ 配置 (Config v2)

在 `.research/config.yaml` 中自定义工作流：

```yaml
version: "2"

statusFlow:
  idea:
    initial: exploring
    transitions:
      exploring: [validated, refuted, parked]
      validated: [exploring]
      refuted: []

fields:
  experiment:
    required: [purpose]

metrics:
  requiredKeys: [accuracy, loss]
  ranges:
    accuracy: { min: 0, max: 1 }

hooks:
  onExperimentStatusChange:
    - to: running
      actions:
        - type: add-log
          template: "实验 {{entityId}} 开始运行"
    - to: completed
      actions:
        - type: update-field
          target: idea
          locateBy: parent
          updates:
            status: validated
```

## 🛠️ 技术栈

- **TypeScript** — 类型安全
- **Commander.js** — CLI 框架
- **@modelcontextprotocol/sdk** — MCP Server
- **gray-matter + YAML** — Markdown 解析
- **Ajv** — JSON Schema 校验
- **Vitest** — 测试

## 🔗 相关项目

- [researchtracker-vscode](https://github.com/YYNanFeng/researchtracker-vscode) — VS Code 插件，提供侧边栏树形视图

## 🤝 贡献

欢迎贡献！请随时提交 Issue 或 Pull Request。

## 📜 许可证

[MIT](LICENSE)
