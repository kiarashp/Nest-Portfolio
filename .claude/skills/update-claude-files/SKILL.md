---
name: update-claude-files
description: Sync all CLAUDE.md files and STATE.md with recent code changes. Use when the user says "update the claude.md files", "update claude files", "update claude file", or misspelled variants like "update cluade files", "update cluade fule", "update calude md".
---

# Update CLAUDE.md files and STATE.md

Bring the project's documentation files in line with what has actually changed in the codebase. Never invent or speculate — document only changes you can verify.

## Step 1 — Determine what changed

Gather the change set from all of these sources:

1. **This conversation**: if work was just done in the current session, that is the primary change set.
2. **Uncommitted work**: run `git status` and `git diff` (both staged and unstaged) to see pending changes.
3. **Recent commits**: find the last commit that touched any CLAUDE.md or STATE.md file, then review everything since:
   ```bash
   git log -1 --format=%H -- CLAUDE.md 'src/**/CLAUDE.md' test/CLAUDE.md STATE.md
   git log --oneline <that-hash>..HEAD
   git diff --stat <that-hash>..HEAD
   ```
   If the diff stat shows relevant files, inspect the actual diffs for those areas.

Build a short list of concrete changes (new endpoints, new modules/providers, changed behavior, new env vars, new scripts, new entities/relations, new tests/conventions) before touching any doc.

## Step 2 — Read the documentation files

Read every CLAUDE.md in the repo plus STATE.md. Find them with a glob for `**/CLAUDE.md` (ignore `node_modules`). Current known set:

- `CLAUDE.md` (root — commands, architecture, request pipeline, routes, serialization, pagination, events, gotchas)
- `src/auth/CLAUDE.md` (RBAC, guards)
- `src/mail/CLAUDE.md`
- `src/audit-log/CLAUDE.md`
- `src/uploads/CLAUDE.md`
- `src/products/CLAUDE.md`
- `test/CLAUDE.md` (e2e helpers and spec conventions)
- `STATE.md` (completed state summary + "Upcoming features" backlog)

## Step 3 — Reflect the changes

For each change in the list, decide which file(s) own that topic and update them:

- **Scope**: put module-internal detail in the nested `src/<module>/CLAUDE.md`; put cross-cutting facts (new module wiring, request pipeline, routes list, env vars, npm scripts, entity relations, OpenAPI typing) in the root `CLAUDE.md`. Test infrastructure/conventions go in `test/CLAUDE.md`.
- **STATE.md**: if a change completes (fully or partly) an item under "Upcoming features", remove or amend that item and, if useful, fold the outcome into the intro paragraph. If the work surfaced a new deferred decision or follow-up, add it as a new item in the same format as the existing ones.
- **New nested docs**: if a brand-new module got its own CLAUDE.md, add it to the "Nested guidance" line at the top of the root CLAUDE.md.
- **Style**: match each file's existing tone and structure — dense prose, backticked paths, tables where the file already uses tables. Don't restructure sections that aren't affected. Don't duplicate detail that lives in controllers/code unless the file already documents that kind of detail (the root CLAUDE.md deliberately documents non-obvious rules, not route-by-route listings).
- **Accuracy over completeness**: if unsure whether a behavior changed, read the source file to confirm before writing it into a doc. Never describe intended-but-unimplemented behavior as done.

## Step 4 — Report

Summarize per file what was updated and why, and list any changes you deliberately did **not** document (with the reason). If nothing needed updating, say so explicitly.
