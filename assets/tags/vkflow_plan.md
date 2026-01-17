# VKFlow Planning Prompt (OpenSpec + Superpowers + Vibe Kanban)

You are the tech lead. Do NOT write business code yet.

## 1) Clarify
List up to 5 questions that must be answered before implementation. If none, say "No blocking questions".

## 2) Create/Open the OpenSpec change
- If no change exists: run `npx -y @fission-ai/openspec@latest new change <slug> --description "..."`
- Ensure the change contains a proposal/PRD artifact and a tasks artifact.

## 3) Produce artifacts
- Write/Update the PRD/proposal (use `@openspec_prd` structure).
- Write `openspec/changes/<slug>/tasks.md` using `@vkflow_tasks_format` so it can be imported into Vibe Kanban.

## 4) Validate
Run: `npx -y @fission-ai/openspec@latest validate <slug>` (or `validate` for the change).

## 5) Output a Kanban-ready task list
For each task section in tasks.md, output:
- Title
- 1 paragraph description
- Acceptance criteria checklist
- Dependencies / ordering

If I ask: "Then turn this plan into tasks", use Vibe Kanban MCP or the Vibe Kanban UI to create the tasks.