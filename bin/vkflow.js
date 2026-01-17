#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const { ensureDir, readText, writeText } = require('../lib/fs');
const { assetPath } = require('../lib/paths');
const { loadTagCatalog } = require('../lib/tagCatalog');
const { resolveVkBaseUrl, upsertTag, createTask } = require('../lib/vk');
const { runOpenSpecInit } = require('../lib/openspec');
const { parseTasksFromMarkdown } = require('../lib/tasksParser');

function parseCli(argv) {
  const args = argv.slice(2);
  const command = args[0] || 'help';
  const rest = args.slice(1);

  const flags = {};
  const positionals = [];

  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      if (a.startsWith('--no-')) {
        flags[a.slice('--no-'.length)] = false;
        continue;
      }

      const eq = a.indexOf('=');
      if (eq !== -1) {
        const k = a.slice(2, eq);
        const v = a.slice(eq + 1);
        flags[k] = v;
        continue;
      }

      const k = a.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith('-')) {
        flags[k] = next;
        i++;
      } else {
        flags[k] = true;
      }
    } else {
      positionals.push(a);
    }
  }

  return { command, flags, positionals };
}

function printHelp() {
  const help = `vkflow (vk-workflow-kit)

Commands:
  init [--tools <openspec-tools>] [--seed-tags] [--vk-url <url>] [--force]
  seed-tags [--vk-url <url>] [--no-overwrite]
  import-change --change <name> --project-id <uuid> [--vk-url <url>] [--tasks-file <path>] [--dry-run]

Notes:
- Vibe Kanban URL auto-detection checks: --vk-url, VIBE_BACKEND_URL, BACKEND_PORT/PORT, or temp port file.
- OpenSpec init runs via: npx -y @fission-ai/openspec@latest init
`;
  process.stdout.write(help);
}

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

async function cmdSeedTags(flags) {
  const baseUrl = resolveVkBaseUrl({ vkUrl: flags['vk-url'] });
  const overwrite = flags.overwrite !== false;

  const catalog = loadTagCatalog();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const tag of catalog.tags) {
    const result = await upsertTag(
      baseUrl,
      { tag_name: tag.tag_name, content: tag.content },
      { overwrite }
    );
    if (result.action === 'created') created++;
    else if (result.action === 'updated') updated++;
    else skipped++;

    process.stdout.write(
      `${result.action.padEnd(7)} @${tag.tag_name} (${tag.source})\n`
    );
  }

  process.stdout.write(
    `\nDone. created=${created} updated=${updated} skipped=${skipped}\n`
  );
}

async function cmdInit(flags) {
  const cwd = process.cwd();
  const tools = typeof flags.tools === 'string' ? flags.tools : 'codex,claude';
  const force = flags.force === true;

  // 1) OpenSpec init (non-interactive)
  runOpenSpecInit({ tools, pathArg: cwd });

  // 2) Write vkflow helper files
  const vkflowDir = path.join(cwd, '.vkflow');
  ensureDir(vkflowDir);

  const vkflowReadme = readText(assetPath('templates', 'vkflow-readme.md'));
  writeText(path.join(vkflowDir, 'README.md'), vkflowReadme, { force });

  // 3) Optional CI workflow (safe default: only create if absent)
  const ghWorkflowPath = path.join(
    cwd,
    '.github',
    'workflows',
    'openspec-validate.yml'
  );
  if (!fileExists(ghWorkflowPath) || force) {
    const wf = readText(assetPath('templates', 'openspec-validate.yml'));
    writeText(ghWorkflowPath, wf, { force: true });
  }

  process.stdout.write('\nInit complete.\n');
  process.stdout.write(
    '- Next: start Vibe Kanban and run: vkflow seed-tags\n'
  );

  if (flags['seed-tags']) {
    process.stdout.write('\nSeeding tags...\n');
    await cmdSeedTags(flags);
  }
}

async function cmdImportChange(flags) {
  const baseUrl = resolveVkBaseUrl({ vkUrl: flags['vk-url'] });
  const change = flags.change;
  const projectId = flags['project-id'];

  if (!change || !projectId) {
    throw new Error('import-change requires --change <name> and --project-id <uuid>');
  }

  const cwd = process.cwd();
  const tasksFile =
    typeof flags['tasks-file'] === 'string'
      ? path.resolve(cwd, flags['tasks-file'])
      : path.join(cwd, 'openspec', 'changes', change, 'tasks.md');

  if (!fileExists(tasksFile)) {
    throw new Error(`Tasks file not found: ${tasksFile}`);
  }

  const md = readText(tasksFile);
  const tasks = parseTasksFromMarkdown(md);

  if (tasks.length === 0) {
    throw new Error('No tasks found in tasks.md. Use @vkflow_tasks_format.');
  }

  if (flags['dry-run']) {
    process.stdout.write(`Would create ${tasks.length} tasks in project ${projectId}:\n`);
    for (const t of tasks) {
      process.stdout.write(`- ${t.title}\n`);
    }
    return;
  }

  for (const t of tasks) {
    const description = [
      t.description,
      '',
      '---',
      `Spec: openspec/changes/${change}`,
      '',
      'Execution:',
      '- Follow TDD + small steps (see @superpowers_tdd)',
    ]
      .filter((s) => s !== undefined)
      .join('\n')
      .trim();

    await createTask(baseUrl, {
      project_id: projectId,
      title: t.title,
      description,
    });

    process.stdout.write(`created  ${t.title}\n`);
  }

  process.stdout.write(`\nDone. Imported ${tasks.length} tasks.\n`);
}

async function main() {
  const { command, flags } = parseCli(process.argv);

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'init') {
    await cmdInit(flags);
    return;
  }

  if (command === 'seed-tags') {
    await cmdSeedTags(flags);
    return;
  }

  if (command === 'import-change') {
    await cmdImportChange(flags);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((err) => {
  process.stderr.write(`\nError: ${err.message}\n`);
  if (process.env.VKFLOW_DEBUG) {
    process.stderr.write(`${err.stack}\n`);
  }
  process.exit(1);
});