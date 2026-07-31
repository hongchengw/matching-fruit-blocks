# Changelog

Every change to this repository gets an entry. **Newest first.** Append at the top, never
rewrite an existing entry.

## Format

```
## YYYY-MM-DD HH:MM EDT | <conventional-commit-style summary>
<1 to 3 lines: what changed, which tests now cover it, anything deferred>
```

Timestamps are **EDT**, never UTC and never the machine's local time:

```
TZ=America/New_York date "+%Y-%m-%d %H:%M EDT"
```

See [`../AGENTS.md`](../AGENTS.md) for the full per-task loop this log is part of.

---

## 2026-07-31 06:33 EDT | feat(tooling): vitest and playwright scaffold (task 01)

Added `package.json` (devDependencies only, `type: module`), `vitest.config.js` with the
jsdom environment, `playwright.config.js`, and a dependency-free static server at
`scripts/serve.js` for Playwright's `webServer`.
Covered by `tests/unit/smoke.test.js` (runner executes, jsdom available) and
`tests/e2e/smoke.spec.js` (static server responds 200). `npm test` and `npm run e2e` both
green. Only chromium is installed locally; task 22's cross-engine run will need the rest.

## 2026-07-31 06:21 EDT | docs: project specification and 22-task backlog

Added `SPEC.md` as the source of truth, rewrote `AGENTS.md` with the RED/GREEN per-task loop,
and created `tasks/` with an index plus 22 task files covering scaffold through final
integration.
No application code, test code, or tooling config written; every task file specifies the
failing tests to write first. Documentation-only, so the test gate does not apply per
`AGENTS.md`. Awaiting review before build begins.
