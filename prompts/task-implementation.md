/loop 30s Implement exactly ONE pending chat task.

## Scope (read only what you need)
- docs/chats/tasks.md — find the first heading `## N. [ ]` in numeric order; read only that task block
- docs/chats/design.md and docs/chats/requirements.md — only sections cited by that task
- AGENTS.md and applicable .cursor/rules/ (api-layer, feature-architecture, supabase-migrations, etc.)

## Project standards and code quality
- **Always follow project patterns.** Before writing code, read surrounding files in the same feature/area and match naming, structure, imports, and abstractions. Respect AGENTS.md and every applicable rule in `.cursor/rules/` — they are mandatory, not optional.
- **Code quality is paramount.** The deliverable must be production-ready: clear, consistent, minimal scope, no shortcuts or “good enough for now” hacks. Prefer extending existing code over reinventing; keep diffs focused on the task.
- When in doubt, align with the current features and the rules cited in the task or Scope above.

## Task selection
1. Pick the first task with `[ ]` (respect waves order and the task’s Dependencies).
2. If Dependencies are not satisfied, STOP the loop and report which gate is missing — do not skip ahead.
3. Implement only that task’s Deliverables (migrations, RPCs, Edge, tests). One task per tick. Do not skip task numbers.

## Validation (strict — do not broaden scope)

### SQL / migrations only
If the change is **only** SQL under `supabase/migrations/` (or SQL referenced by the task):
- Do **not** run `yarn db:migrate`, `yarn db:reset`, or any other DB command.
- Do **not** run `yarn test:run` or the full test suite.
- Validate by review: syntax, naming, design alignment, idempotency, and task Deliverables.

### Code changes (TS/TSX/Edge/etc.)
- Do **not** run the full test suite (`yarn test:run` without a path).
- Run **only** unit tests for files you created or modified in this tick, e.g.:
`source ~/.nvm/nvm.sh 2>/dev/null; nvm use 24.13 && yarn test:run <path/to/changed.test.ts>`
- If you changed no testable source files, run no tests.
- Do **not** run `yarn db:reset`. Do **not** migrate unless the task explicitly requires applying SQL locally (default: no DB commands).

### Mixed SQL + code
- Apply SQL rules for migration files; apply code rules for app/Edge changes.

## Completion
4. If validation passes: mark `## N. [x]` in tasks.md. Commit only if I explicitly ask.
5. If blocked (credentials, product decision, missing dependency): add a short **Blocker** note under that task in tasks.md and STOP the loop (kill loop processes; do not arm the next tick).
6. If `[ ]` tasks remain: end with `TASK_DONE` and arm the next tick per loop skill (`notify_on_output` on `^AGENT_LOOP_TICK_mmd` for fixed loops).
7. If no `[ ]` tasks remain: end with `ALL_COMPLETE` and STOP the loop.

Do not implement two tasks in the same tick.