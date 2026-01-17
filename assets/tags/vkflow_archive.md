# OpenSpec Archive / Closeout

When all tasks in a change are completed and merged:

1) Ensure `openspec/changes/<slug>/tasks.md` is fully checked off.
2) Validate again: `npx -y @fission-ai/openspec@latest validate <slug>`
3) Archive the change back into main specs:
   - `npx -y @fission-ai/openspec@latest archive <slug> --yes`
4) Create a final Vibe Kanban task summary (what shipped, links to PRs, risks).