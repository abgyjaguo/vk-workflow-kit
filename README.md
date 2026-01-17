# vk-workflow-kit

A tiny CLI that glues together:

- **OpenSpec** (spec-driven development artifacts)
- **Superpowers** (prompted planning + TDD execution discipline)
- **Vibe Kanban** (safe AI execution with task boards, worktrees, and review)

The goal: in a fresh repo, run a single command to get a usable spec+planning workflow, plus a set of Vibe Kanban `@tags` that standardize PRDs/prompts.

## Quickstart

### 1) Bootstrap OpenSpec + workflow files

From your target project repo:

```bash
npx -y vk-workflow-kit init
```

### 2) Seed Vibe Kanban tags

Start Vibe Kanban, then:

```bash
npx -y vk-workflow-kit seed-tags
```

If Vibe Kanban is not running on the default port, set:

```bash
export VIBE_BACKEND_URL=http://127.0.0.1:PORT
```

### 3) Use tags in tasks

In Vibe Kanban task descriptions (or via MCP `create_task`), use:

- `@openspec_prd`
- `@vkflow_plan`
- `@vkflow_tasks_format`
- `@superpowers_tdd`

## CLI

- `vkflow init [--tools <openspec-tools>] [--seed-tags] [--vk-url <url>]`
- `vkflow seed-tags [--vk-url <url>] [--no-overwrite]`
- `vkflow import-change --change <name> --project-id <uuid> [--vk-url <url>] [--dry-run]`

## License

MIT. See `LICENSE`.