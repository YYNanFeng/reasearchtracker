import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ResearchTracker } from '../index.js';

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (params: Record<string, unknown>, rootDir: string) => Promise<unknown>;
}

const tools: ToolDefinition[] = [
  {
    name: 'research_status',
    description: 'Get the current research project status overview',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', description: 'Output format: json, table, or markdown' },
      },
    },
    handler: async (params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      return tracker.getStatus(params.format as string | undefined);
    },
  },
  {
    name: 'research_get_idea',
    description: 'Get details of a specific idea',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The idea ID (e.g. idea-fpn-cbam)' },
      },
      required: ['id'],
    },
    handler: async (params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      return tracker.getIdea(params.id as string);
    },
  },
  {
    name: 'research_list_ideas',
    description: 'List all ideas, optionally filtered by status',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status: exploring, validated, refuted, parked, abandoned' },
        format: { type: 'string', description: 'Output format: json or table' },
      },
    },
    handler: async (params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      const filter: { status?: string } = {};
      if (params.status) filter.status = params.status as string;
      return tracker.listIdeas(filter);
    },
  },
  {
    name: 'research_add_idea',
    description: 'Add a new research idea. You MUST write a meaningful body following this template:\n'
      + '## 思路展开 (required) — Detailed reasoning, observations, why this idea might work\n'
      + '## 实验验证 (situational) — Reference completed experiments with evidence\n'
      + '## 后续方向 (situational) — TODOs and next steps to validate',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Idea title' },
        claim: { type: 'string', description: 'What this idea claims/proposes (one sentence summary, will be stored in frontmatter)' },
        evidence: { type: 'string', description: 'Supporting evidence from non-experimental sources (theory, literature)' },
        parents: { type: 'string', description: 'Parent idea relationships (format: id:relation,id:relation). Relations: evolves_from, inspired_by, builds_on, contradicts, alternative_to, refines' },
        confidence: { type: 'number', description: 'Confidence level 0-1' },
        tags: { type: 'string', description: 'Comma-separated tags' },
        body: { type: 'string', description: 'Markdown body. MUST include "## 思路展开" section with detailed reasoning. Optionally add "## 实验验证" and "## 后续方向". Do NOT repeat frontmatter fields.' },
      },
      required: ['title', 'claim'],
    },
    handler: async (params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      return tracker.addIdea({
        title: params.title as string,
        claim: params.claim as string,
        evidence: params.evidence as string | undefined,
        parents: params.parents as string | undefined,
        confidence: params.confidence as number | undefined,
        tags: params.tags as string | undefined,
        body: params.body as string | undefined,
      });
    },
  },
  {
    name: 'research_update_idea',
    description: 'Update an existing idea',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The idea ID to update' },
        status: { type: 'string', description: 'New status: exploring, validated, refuted, parked, abandoned' },
        confidence: { type: 'number', description: 'New confidence level 0-1' },
        evidence: { type: 'string', description: 'Updated evidence' },
        evidence_link: { type: 'string', description: 'Evidence link (format: result-id:verdict)' },
      },
      required: ['id'],
    },
    handler: async (params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      return tracker.updateIdea(params.id as string, {
        status: params.status as string | undefined,
        confidence: params.confidence as number | undefined,
        evidence: params.evidence as string | undefined,
        evidence_link: params.evidence_link as string | undefined,
      });
    },
  },
  {
    name: 'research_get_experiment',
    description: 'Get details of a specific experiment',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The experiment ID (e.g. exp-001-baseline)' },
      },
      required: ['id'],
    },
    handler: async (params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      return tracker.getExperiment(params.id as string);
    },
  },
  {
    name: 'research_list_experiments',
    description: 'List experiments, optionally filtered by idea, status, or tags',
    inputSchema: {
      type: 'object',
      properties: {
        idea: { type: 'string', description: 'Filter by parent idea ID' },
        status: { type: 'string', description: 'Filter by status: planned, running, completed, failed, cancelled' },
        tags: { type: 'string', description: 'Filter by comma-separated tags' },
        format: { type: 'string', description: 'Output format: json or table' },
      },
    },
    handler: async (params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      const filter: { idea?: string; status?: string; tags?: string } = {};
      if (params.idea) filter.idea = params.idea as string;
      if (params.status) filter.status = params.status as string;
      if (params.tags) filter.tags = params.tags as string;
      return tracker.listExperiments(filter);
    },
  },
  {
    name: 'research_create_experiment',
    description: 'Create a new experiment under an idea. You MUST write a meaningful body following this template:\n'
      + '## 实验设置 (required) — What was changed, how it differs from based_on experiment\n'
      + '## 过程记录 (situational) — Training observations, loss curves, anomalies\n'
      + '## 关键观察 (situational) — Notable findings during the experiment\n'
      + '## 运行命令 (situational) — Reproducible commands',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Experiment title' },
        idea: { type: 'string', description: 'Parent idea ID' },
        purpose: { type: 'string', description: 'Why this experiment is being conducted' },
        based_on: { type: 'string', description: 'Base experiment ID for config inheritance' },
        commits: { type: 'string', description: 'Comma-separated commit hashes' },
        tags: { type: 'string', description: 'Comma-separated tags' },
        body: { type: 'string', description: 'Markdown body. MUST include "## 实验设置" section describing what was changed and setup details. Optionally add "## 过程记录", "## 关键观察", "## 运行命令". Do NOT repeat frontmatter fields.' },
      },
      required: ['title', 'idea'],
    },
    handler: async (params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      return tracker.createExperiment({
        title: params.title as string,
        idea: params.idea as string,
        purpose: params.purpose as string | undefined,
        based_on: params.based_on as string | undefined,
        commits: params.commits as string | undefined,
        tags: params.tags as string | undefined,
        body: params.body as string | undefined,
      });
    },
  },
  {
    name: 'research_update_experiment',
    description: 'Update an existing experiment',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The experiment ID to update' },
        status: { type: 'string', description: 'New status: planned, running, completed, failed, cancelled' },
        commits: { type: 'string', description: 'Comma-separated commit hashes to add' },
      },
      required: ['id'],
    },
    handler: async (params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      return tracker.updateExperiment(params.id as string, {
        status: params.status as string | undefined,
        commits: params.commits as string | undefined,
      });
    },
  },
  {
    name: 'research_log_result',
    description: 'Log a result for an experiment. You MUST write a meaningful body following this template:\n'
      + '## 分析 (required) — In-depth interpretation of claim and evidence, what the numbers mean\n'
      + '## 对比 (situational) — Comparison table with other experiments',
    inputSchema: {
      type: 'object',
      properties: {
        experiment_id: { type: 'string', description: 'The experiment ID' },
        claim: { type: 'string', description: 'What the result concludes (one sentence summary)' },
        evidence: { type: 'string', description: 'Evidence supporting the claim (quantitative)' },
        status: { type: 'string', description: 'Result status: success or failed' },
        metrics: { type: 'string', description: 'JSON string of metrics (required when status=success)' },
        body: { type: 'string', description: 'Markdown body. MUST include "## 分析" section with detailed interpretation. Optionally add "## 对比" with a comparison table. Do NOT repeat frontmatter fields.' },
      },
      required: ['experiment_id', 'claim', 'evidence', 'status'],
    },
    handler: async (params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      return tracker.logResult({
        experiment_id: params.experiment_id as string,
        claim: params.claim as string,
        evidence: params.evidence as string,
        status: params.status as 'success' | 'failed',
        metrics: params.metrics as string | undefined,
        body: params.body as string | undefined,
      });
    },
  },
  {
    name: 'research_compare',
    description: 'Compare metrics across multiple experiments',
    inputSchema: {
      type: 'object',
      properties: {
        experiment_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of experiment IDs to compare',
        },
        format: { type: 'string', description: 'Output format: table, markdown, or json' },
      },
      required: ['experiment_ids'],
    },
    handler: async (params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      return tracker.compare(
        params.experiment_ids as string[],
        params.format as string | undefined,
      );
    },
  },
  {
    name: 'research_search',
    description: 'Search across all research nodes by keyword',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Search keyword' },
      },
      required: ['keyword'],
    },
    handler: async (params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      return tracker.search(params.keyword as string);
    },
  },
  {
    name: 'research_timeline',
    description: 'Get research timeline with optional date range',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        format: { type: 'string', description: 'Output format: json or markdown' },
      },
    },
    handler: async (params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      const filter: { from?: string; to?: string } = {};
      if (params.from) filter.from = params.from as string;
      if (params.to) filter.to = params.to as string;
      return tracker.getTimeline(filter);
    },
  },
  {
    name: 'research_add_reference',
    description: 'Add a literature reference. You MUST write a meaningful body following this template:\n'
      + '## 核心思想 (required) — Summarize the paper\'s key contributions in your own words\n'
      + '## 与本研究的关联 (situational) — How this paper relates to or inspires the current research',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Reference key (e.g. lin2017fpn)' },
        title: { type: 'string', description: 'Paper title' },
        authors: { type: 'string', description: 'Author names' },
        year: { type: 'number', description: 'Publication year' },
        venue: { type: 'string', description: 'Publication venue (conference/journal)' },
        url: { type: 'string', description: 'URL to the paper' },
        tags: { type: 'string', description: 'Comma-separated tags' },
        body: { type: 'string', description: 'Markdown body. MUST include "## 核心思想" section summarizing key contributions. Optionally add "## 与本研究的关联". Do NOT repeat frontmatter fields.' },
      },
      required: ['key', 'title', 'authors', 'year'],
    },
    handler: async (params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      return tracker.addReference({
        key: params.key as string,
        title: params.title as string,
        authors: params.authors as string,
        year: params.year as number,
        venue: params.venue as string | undefined,
        url: params.url as string | undefined,
        tags: params.tags as string | undefined,
        body: params.body as string | undefined,
      });
    },
  },
  {
    name: 'research_add_log',
    description: 'Add a research log entry',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Log entry content' },
      },
      required: ['content'],
    },
    handler: async (params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      return tracker.addLog(params.content as string);
    },
  },
  {
    name: 'research_get_config',
    description: 'Get the project configuration. Use resolved=true to see fully merged config with defaults.',
    inputSchema: {
      type: 'object',
      properties: {
        resolved: { type: 'boolean', description: 'Return resolved config with all defaults merged in' },
      },
    },
    handler: async (params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      return tracker.getConfig(params.resolved as boolean | undefined);
    },
  },
  {
    name: 'research_set_config',
    description: 'Set a configuration value. Supports nested paths like "statusFlow.idea.initial". Value is auto-parsed (numbers, booleans, JSON objects supported).',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Config key path (e.g. "statusFlow.idea.initial", "git.enabled")' },
        value: { type: 'string', description: 'Value to set (auto-parsed: numbers, booleans, JSON)' },
      },
      required: ['key', 'value'],
    },
    handler: async (params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      await tracker.setConfig(params.key as string, params.value as string);
      return { success: true, key: params.key, value: params.value };
    },
  },
  {
    name: 'research_validate_config',
    description: 'Validate the project configuration and return any issues found.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_params, rootDir) => {
      const tracker = new ResearchTracker();
      await tracker.open(rootDir);
      const issues = await tracker.validateConfigAlone();
      return { valid: issues.length === 0, issues };
    },
  },
];

export function registerTools(server: Server, rootDir: string): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = tools.find((t) => t.name === name);

    if (!tool) {
      return {
        content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      const result = await tool.handler(args ?? {}, rootDir);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: message }],
        isError: true,
      };
    }
  });
}
