# vkflow workflow

This folder is created by `vkflow init`.

Recommended workflow:

1) Create a planning task in Vibe Kanban using `@vkflow_plan`.
2) Generate `openspec/changes/<slug>/proposal.md` + `openspec/changes/<slug>/tasks.md`.
3) Import tasks into Vibe Kanban with:
   `vkflow import-change --change <slug> --project-id <uuid>`
4) Implement tasks with `@superpowers_tdd`.
5) When complete, archive the change with `@vkflow_archive`.