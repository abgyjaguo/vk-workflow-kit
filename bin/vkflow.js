#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('node:readline/promises');

const { ensureDir, readText, writeText } = require('../lib/fs');
const { assetPath } = require('../lib/paths');
const { loadTagCatalog } = require('../lib/tagCatalog');
const {
  resolveVkBaseUrl,
  listProjects,
  listTasks,
  upsertTag,
  createTask,
} = require('../lib/vk');
const { runOpenSpecInit, runOpenSpecNewChange } = require('../lib/openspec');
const { parseTasksFromMarkdown } = require('../lib/tasksParser');
const {
  computeTaskId,
  extractVkflowMarkers,
  makeChangeMarker,
  makeTaskMarker,
} = require('../lib/vkflowMarkers');

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
  new-change --change <name> [--description <text>] [--schema <name>] [--force]
  plan-change --change <name> [--project-id <uuid> | --project <name>] [--vk-url <url>] [--allow-duplicates]
  seed-tags [--vk-url <url>] [--no-overwrite]
  import-change --change <name> [--project-id <uuid> | --project <name>] [--vk-url <url>] [--tasks-file <path>] [--dry-run] [--allow-duplicates] [--no-superpowers]

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

function normalizeString(s) {
  return String(s ?? '').trim().toLowerCase();
}

let cachedTagCatalog = null;
function getTagContent(tagName) {
  if (!cachedTagCatalog) {
    cachedTagCatalog = loadTagCatalog();
  }

  const tag = cachedTagCatalog.tags.find((t) => t.tag_name === tagName);
  if (!tag) {
    throw new Error(`Unknown tag: ${tagName}`);
  }

  return String(tag.content || '').trim();
}

function formatProjectLine(project, index) {
  const id = String(project.id || '');
  const shortId = id.length > 8 ? `${id.slice(0, 8)}…` : id;
  return `[${String(index + 1).padStart(2, ' ')}] ${project.name} (${shortId})`;
}

async function promptSelectProject(projects) {
  if (!process.stdin.isTTY) {
    throw new Error(
      'No TTY available. Pass --project-id <uuid> or --project <name>.'
    );
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    process.stdout.write('Select a Vibe Kanban project:\n');
    for (let i = 0; i < projects.length; i++) {
      process.stdout.write(`  ${formatProjectLine(projects[i], i)}\n`);
    }

    // Loop until we get a valid selection.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const answer = await rl.question(
        `\nEnter a number (1-${projects.length}, or 'q' to quit): `
      );
      const trimmed = answer.trim();
      if (trimmed.toLowerCase() === 'q') {
        throw new Error('Aborted.');
      }
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n < 1 || n > projects.length) {
        process.stdout.write('Invalid selection. Try again.\n');
        continue;
      }
      return projects[n - 1].id;
    }
  } finally {
    rl.close();
  }
}

async function resolveProjectId(flags, baseUrl) {
  const projectIdFlag = flags['project-id'];
  if (typeof projectIdFlag === 'string' && projectIdFlag.trim()) {
    return projectIdFlag.trim();
  }

  const projects = await listProjects(baseUrl);
  if (!Array.isArray(projects) || projects.length === 0) {
    throw new Error('No Vibe Kanban projects found.');
  }

  const projectQuery = typeof flags.project === 'string' ? flags.project : null;
  if (projectQuery && projectQuery.trim()) {
    const q = normalizeString(projectQuery);
    const matches = projects.filter((p) => normalizeString(p.name).includes(q));

    if (matches.length === 0) {
      const names = projects.map((p) => p.name).join(', ');
      throw new Error(
        `No projects matched --project ${JSON.stringify(projectQuery)}. Available: ${names}`
      );
    }

    if (matches.length === 1) {
      return matches[0].id;
    }

    return promptSelectProject(matches);
  }

  return promptSelectProject(projects);
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

async function cmdNewChange(flags, positionals) {
  const cwd = process.cwd();
  const change = flags.change || positionals?.[0];
  const description = typeof flags.description === 'string' ? flags.description : undefined;
  const schema = typeof flags.schema === 'string' ? flags.schema : undefined;
  const force = flags.force === true;

  if (!change) {
    throw new Error('new-change requires --change <name>');
  }

  const openSpecDir = path.join(cwd, 'openspec');
  if (!fileExists(openSpecDir)) {
    throw new Error('OpenSpec not initialized in this repo. Run: vkflow init');
  }

  const changeDir = path.join(openSpecDir, 'changes', change);
  if (!fileExists(changeDir)) {
    runOpenSpecNewChange({ name: change, description, schema });
  }

  const tasksPath = path.join(changeDir, 'tasks.md');
  const proposalPath = path.join(changeDir, 'proposal.md');

  if (!fileExists(tasksPath) || force) {
    const tasksFormat = getTagContent('vkflow_tasks_format');
    const content = [
      `# Tasks: ${change}`,
      '',
      'Fill this file with tasks. When ready, import to Vibe Kanban:',
      `- vkflow import-change --change ${change}`,
      '',
      'Use this format:',
      '',
      '```md',
      tasksFormat,
      '```',
      '',
    ].join('\n');
    writeText(tasksPath, content, { force: true });
  }

  if (!fileExists(proposalPath) || force) {
    const prd = getTagContent('openspec_prd');
    const content = [
      `# Proposal: ${change}`,
      '',
      'Draft the PRD/proposal below:',
      '',
      '```md',
      prd,
      '```',
      '',
    ].join('\n');
    writeText(proposalPath, content, { force: true });
  }

  process.stdout.write('\nChange ready:\n');
  process.stdout.write(`- ${tasksPath}\n`);
  process.stdout.write(`- ${proposalPath}\n`);
}

async function cmdPlanChange(flags, positionals) {
  const baseUrl = resolveVkBaseUrl({ vkUrl: flags['vk-url'] });
  const change = flags.change || positionals?.[0];

  if (!change) {
    throw new Error('plan-change requires --change <name>');
  }

  // Ensure the change exists locally (creates skeleton files if missing).
  await cmdNewChange(flags, positionals || []);

  const projectId = await resolveProjectId(flags, baseUrl);
  const allowDuplicates = flags['allow-duplicates'] === true;

  const existing = await listTasks(baseUrl, { projectId });
  for (const t of existing || []) {
    const markers = extractVkflowMarkers(t.description);
    if (markers && markers.change === change && markers.task === 'plan') {
      if (!allowDuplicates) {
        process.stdout.write(
          `skipped  Plan task already exists for change '${change}'\n`
        );
        return;
      }
      break;
    }
  }

  const markerChange = makeChangeMarker(change);
  const prd = getTagContent('openspec_prd');
  const tasksFormat = getTagContent('vkflow_tasks_format');
  const planningPrompt = getTagContent('vkflow_plan');

  const body = [
    markerChange,
    makeTaskMarker('plan'),
    '',
    `# Plan change: ${change}`,
    '',
    'Goal: produce OpenSpec proposal + tasks, then import tasks into Vibe Kanban.',
    '',
    '## Prompt',
    planningPrompt,
    '',
    '## PRD template',
    '```md',
    prd,
    '```',
    '',
    '## tasks.md format',
    '```md',
    tasksFormat,
    '```',
    '',
    '## Next',
    `- Run: vkflow import-change --change ${change}`,
    '',
  ].join('\n');

  await createTask(baseUrl, {
    project_id: projectId,
    title: `Plan: ${change}`,
    description: body,
  });

  process.stdout.write(`created  Plan: ${change}\n`);
}

async function cmdImportChange(flags) {
  const baseUrl = resolveVkBaseUrl({ vkUrl: flags['vk-url'] });
  const change = flags.change;

  if (!change) {
    throw new Error('import-change requires --change <name>');
  }

  const projectId = await resolveProjectId(flags, baseUrl);

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

  const allowDuplicates = flags['allow-duplicates'] === true;
  const embedSuperpowers = flags.superpowers !== false;
  const superpowers = embedSuperpowers ? getTagContent('superpowers_tdd') : null;

  const markerChange = makeChangeMarker(change);

  const existing = await listTasks(baseUrl, { projectId });
  const existingTaskIds = new Set();
  for (const t of existing || []) {
    const markers = extractVkflowMarkers(t.description);
    if (markers && markers.change === change && markers.task) {
      existingTaskIds.add(markers.task);
    }
  }

  if (flags['dry-run']) {
    process.stdout.write(
      `Would create ${tasks.length} tasks in project ${projectId}:\n`
    );
    for (const t of tasks) {
      process.stdout.write(`- ${t.title}\n`);
    }
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const t of tasks) {
    const taskId = computeTaskId({ title: t.title, description: t.description });

    if (!allowDuplicates && existingTaskIds.has(taskId)) {
      skipped++;
      process.stdout.write(`skipped  ${t.title}\n`);
      continue;
    }

    const description = [
      markerChange,
      makeTaskMarker(taskId),
      '',
      t.description,
      '',
      '---',
      `Spec: openspec/changes/${change}`,
      '',
      embedSuperpowers ? superpowers : undefined,
    ]
      .filter((s) => s !== undefined)
      .join('\n')
      .trim();

    await createTask(baseUrl, {
      project_id: projectId,
      title: t.title,
      description,
    });

    existingTaskIds.add(taskId);
    created++;
    process.stdout.write(`created  ${t.title}\n`);
  }

  process.stdout.write(`\nDone. created=${created} skipped=${skipped}\n`);
}

async function main() {
  const { command, flags, positionals } = parseCli(process.argv);

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'init') {
    await cmdInit(flags);
    return;
  }

  if (command === 'new-change') {
    await cmdNewChange(flags, positionals);
    return;
  }

  if (command === 'plan-change') {
    await cmdPlanChange(flags, positionals);
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
