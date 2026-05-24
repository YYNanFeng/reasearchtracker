#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { ResearchTracker } from '../index.js';

const program = new Command();

program
  .name('research')
  .description('Research tracking CLI')
  .version('0.1.0')
  .option('--root <dir>', 'Root directory', process.cwd());

function getRootDir(): string {
  return program.optsWithGlobals().root || process.cwd();
}

function prompt(query: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

program
  .command('init')
  .description('Initialize a research project')
  .option('--name <name>')
  .option('--question <question>')
  .action(async (opts) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      let name = opts.name;
      let question = opts.question;
      if (!name) name = await prompt('Project name: ');
      if (!question) question = await prompt('Research question: ');
      await tracker.initProject(name, question);
      console.log('Research project initialized.');
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

const idea = program.command('idea').description('Manage ideas');

idea
  .command('add <title>')
  .description('Add a new idea')
  .requiredOption('--claim <claim>')
  .option('--evidence <evidence>')
  .option('--parents <parents>')
  .option('--confidence <confidence>', 'Confidence level 0-1', parseFloat)
  .option('--tags <tags>')
  .option('--body <body>')
  .action(async (title, opts) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const result = await tracker.addIdea({
        title,
        claim: opts.claim,
        evidence: opts.evidence,
        parents: opts.parents,
        confidence: opts.confidence,
        tags: opts.tags,
        body: opts.body,
      });
      console.log(`Idea created: ${result.id}`);
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

idea
  .command('list')
  .description('List ideas')
  .option('--status <status>')
  .option('--format <format>', 'Output format: json|table', 'table')
  .action(async (opts) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const ideas = await tracker.listIdeas({ status: opts.status });
      if (opts.format === 'json') {
        console.log(JSON.stringify(ideas, null, 2));
      } else {
        console.log(['ID', 'Status', 'Claim', 'Created'].join('\t'));
        for (const item of ideas) {
          console.log([item.id, item.status, item.claim, item.created].join('\t'));
        }
      }
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

idea
  .command('show <id>')
  .description('Show idea details')
  .action(async (id) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const found = await tracker.getIdea(id);
      if (!found) throw new Error(`Idea '${id}' not found`);
      const slug = id.replace(/^idea-/, '');
      const filePath = path.join(getRootDir(), '.research', 'ideas', slug, 'README.md');
      console.log(fs.readFileSync(filePath, 'utf-8'));
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

idea
  .command('update <id>')
  .description('Update an idea')
  .option('--status <status>')
  .option('--confidence <confidence>', 'Confidence level 0-1', parseFloat)
  .option('--evidence <evidence>')
  .option('--evidence-link <evidenceLink>')
  .action(async (id, opts) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const result = await tracker.updateIdea(id, {
        status: opts.status,
        confidence: opts.confidence,
        evidence: opts.evidence,
        evidence_link: opts.evidenceLink,
      });
      console.log(`Idea updated: ${result.id}`);
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

const experiment = program.command('experiment').description('Manage experiments');

experiment
  .command('create <title>')
  .description('Create a new experiment')
  .requiredOption('--idea <ideaId>')
  .option('--purpose <purpose>')
  .option('--based-on <basedOn>')
  .option('--commits <commits>')
  .option('--tags <tags>')
  .option('--body <body>')
  .action(async (title, opts) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const result = await tracker.createExperiment({
        title,
        idea: opts.idea,
        purpose: opts.purpose,
        based_on: opts.basedOn,
        commits: opts.commits,
        tags: opts.tags,
        body: opts.body,
      });
      console.log(`Experiment created: ${result.id}`);
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

experiment
  .command('list')
  .description('List experiments')
  .option('--idea <idea>')
  .option('--status <status>')
  .option('--tags <tags>')
  .option('--format <format>', 'Output format: json|table', 'table')
  .action(async (opts) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const experiments = await tracker.listExperiments({
        idea: opts.idea,
        status: opts.status,
        tags: opts.tags,
      });
      if (opts.format === 'json') {
        console.log(JSON.stringify(experiments, null, 2));
      } else {
        console.log(['ID', 'Status', 'Idea', 'Created'].join('\t'));
        for (const item of experiments) {
          console.log([item.id, item.status, item.idea, item.created].join('\t'));
        }
      }
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

experiment
  .command('show <id>')
  .description('Show experiment details')
  .action(async (id) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const found = await tracker.getExperiment(id);
      if (!found) throw new Error(`Experiment '${id}' not found`);
      const ideaSlug = found.idea.replace(/^idea-/, '');
      const filePath = path.join(
        getRootDir(), '.research', 'ideas', ideaSlug, 'experiments', id, 'README.md'
      );
      console.log(fs.readFileSync(filePath, 'utf-8'));
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

experiment
  .command('update <id>')
  .description('Update an experiment')
  .option('--status <status>')
  .option('--commits <commits>')
  .action(async (id, opts) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const result = await tracker.updateExperiment(id, {
        status: opts.status,
        commits: opts.commits,
      });
      console.log(`Experiment updated: ${result.id}`);
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

experiment
  .command('log-result <id>')
  .description('Log experiment result')
  .requiredOption('--claim <claim>')
  .requiredOption('--evidence <evidence>')
  .requiredOption('--status <status>')
  .option('--metrics <metrics>')
  .option('--body <body>')
  .action(async (id, opts) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const result = await tracker.logResult({
        experiment_id: id,
        claim: opts.claim,
        evidence: opts.evidence,
        status: opts.status,
        metrics: opts.metrics,
        body: opts.body,
      });
      console.log(`Result logged: ${result.id}`);
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

const reference = program.command('reference').description('Manage references');

reference
  .command('add <key>')
  .description('Add a reference')
  .requiredOption('--title <title>')
  .requiredOption('--authors <authors>')
  .requiredOption('--year <year>', 'Publication year', parseInt)
  .option('--venue <venue>')
  .option('--url <url>')
  .option('--tags <tags>')
  .option('--body <body>')
  .action(async (key, opts) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const result = await tracker.addReference({
        key,
        title: opts.title,
        authors: opts.authors,
        year: opts.year,
        venue: opts.venue,
        url: opts.url,
        tags: opts.tags,
        body: opts.body,
      });
      console.log(`Reference added: ${result.key}`);
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

reference
  .command('list')
  .description('List references')
  .option('--format <format>', 'Output format: json|table', 'table')
  .action(async (opts) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const refs = await tracker.listReferences();
      if (opts.format === 'json') {
        console.log(JSON.stringify(refs, null, 2));
      } else {
        console.log(['Key', 'Title', 'Authors', 'Year'].join('\t'));
        for (const ref of refs) {
          console.log([ref.key, ref.title, ref.authors, ref.year].join('\t'));
        }
      }
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

program
  .command('log <content>')
  .description('Add a log entry')
  .action(async (content) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      await tracker.addLog(content);
      console.log('Log entry added.');
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate research data')
  .action(async () => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const result = await tracker.validate();
      if (result.valid) {
        console.log('All validations passed.');
      } else {
        console.log('Validation failed:');
        for (const issue of result.issues) {
          console.log(`  [${issue.level}] ${issue.file}: ${issue.message}`);
        }
        process.exit(1);
      }
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show project status')
  .option('--format <format>', 'Output format: json|table|markdown', 'markdown')
  .action(async (opts) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const output = await tracker.getStatus(opts.format);
      console.log(output);
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

program
  .command('search <keyword>')
  .description('Search research data')
  .action(async (keyword) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const results = await tracker.search(keyword);
      if (results.length === 0) {
        console.log('No results found.');
      } else {
        for (const r of results) {
          console.log(`${r.id} (${r.type}): ${r.snippet}`);
        }
      }
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

program
  .command('timeline')
  .description('Show timeline')
  .option('--from <from>')
  .option('--to <to>')
  .option('--format <format>', 'Output format: json|markdown', 'markdown')
  .action(async (opts) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const entries = await tracker.getTimeline({
        from: opts.from,
        to: opts.to,
      });
      if (opts.format === 'json') {
        console.log(JSON.stringify(entries, null, 2));
      } else {
        for (const entry of entries) {
          console.log(`${entry.date} [${entry.type}] ${entry.content}`);
        }
      }
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

program
  .command('compare <experiment-ids...>')
  .description('Compare experiments')
  .option('--format <format>', 'Output format: table|markdown|json', 'table')
  .action(async (experimentIds, opts) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const output = await tracker.compare(experimentIds, opts.format);
      console.log(output);
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Start MCP server')
  .option('--mcp', 'Use MCP stdio transport')
  .action(async (opts) => {
    try {
      if (!opts.mcp) {
        process.stderr.write('Use --mcp flag to start MCP server\n');
        process.exit(1);
      }
      const { startMcpServer } = await import('../mcp/index.js');
      await startMcpServer(getRootDir());
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

const config = program.command('config').description('Manage configuration');

config
  .command('set <key> <value>')
  .description('Set a config value')
  .action(async (key, value) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      await tracker.setConfig(key, value);
      console.log(`Config set: ${key} = ${value}`);
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

config
  .command('get <key>')
  .description('Get a config value')
  .action(async (key) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const cfg = await tracker.getConfig() as unknown as Record<string, unknown>;
      const value = getNestedValue(cfg, key);
      console.log(value !== undefined ? (typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)) : '');
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

config
  .command('list')
  .description('List all configuration values')
  .option('--resolved', 'Show resolved config with all defaults merged in')
  .action(async (opts) => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const cfg = await tracker.getConfig(opts.resolved);
      console.log(JSON.stringify(cfg, null, 2));
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

config
  .command('validate')
  .description('Validate project configuration')
  .action(async () => {
    try {
      const tracker = new ResearchTracker();
      await tracker.open(getRootDir());
      const issues = await tracker.validateConfigAlone();
      if (issues.length === 0) {
        console.log('Configuration is valid.');
      } else {
        for (const issue of issues) {
          console.log(`  [${issue.level}] ${issue.path}: ${issue.message}`);
        }
        if (issues.some(i => i.level === 'error')) process.exit(1);
      }
    } catch (err: any) {
      process.stderr.write(err.message + '\n');
      process.exit(1);
    }
  });

program.parseAsync();

function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
  const parts = keyPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
