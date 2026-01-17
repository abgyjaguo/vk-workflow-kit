# PRD: vk-workflow-kit

## Problem

Teams want spec-driven development with AI, but day-1 setup is friction:

- Specs/changes/tasks live in different places
- Prompts drift and become inconsistent
- Task boards don’t map cleanly to spec artifacts
- AI execution needs isolation + review

## Goal

Provide a **one-command bootstrap** and a **repeatable workflow** combining:

- OpenSpec artifacts (proposal/spec/tasks)
- Superpowers-style planning + TDD guardrails
- Vibe Kanban task execution + review

## Users

- Solo devs and small teams doing AI-assisted coding
- OSS maintainers who want consistent PRDs/tasks in contributions

## Key workflows

1) **Bootstrap a repo**
   - Initialize OpenSpec in an existing codebase
   - Add minimal helper files and CI validation

2) **Planning**
   - Create an OpenSpec change
   - Produce a PRD + parseable `tasks.md`
   - Validate change

3) **Execution**
   - Import tasks into Vibe Kanban (Kanban-ready cards)
   - Run agents in isolated worktrees
   - Review + merge

4) **Closeout**
   - Archive the OpenSpec change back into main specs

## Non-goals

- Replace Vibe Kanban UI or OpenSpec schema engine
- Provide a full “project management” suite

## Requirements (MVP)

- CLI: `init`, `seed-tags`, `import-change`
- Vibe Kanban tag pack for PRD/prompts
- Deterministic tasks.md format for importing
- No secrets stored; only uses `VIBE_BACKEND_URL` when needed

## Success metrics

- Time-to-first-spec+task-board: < 10 minutes
- Imported tasks match spec tasks 1:1
- Works on macOS/Linux/Windows
