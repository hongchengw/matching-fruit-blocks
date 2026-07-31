# Task 01: Test tooling scaffold

## Objective

Stand up Vitest (with jsdom) and Playwright so every later task has a working RED/GREEN cycle.

## Depends on

Nothing. This is the root of the graph and must land first.

## Spec reference

`SPEC.md` §10 (test strategy), §11 (non-goals: devDependencies only, no build step).

## Files created or modified

- `package.json` (new)
- `vitest.config.js` (new)
- `playwright.config.js` (new)
- `.gitignore` (modify)
- `tests/unit/smoke.test.js` (new)
- `tests/e2e/smoke.spec.js` (new)

## Tests to write first

This task is meta: the tests prove the runners themselves work. Write them before creating
any config, so the initial failure is "no runner configured" rather than an assertion failure.

| Test | Runner | Assertion |
|---|---|---|
| `vitest runner executes` | Vitest | A trivial truth (`expect(1 + 1).toBe(2)`) passes. Fails before `package.json` and `vitest.config.js` exist because `npm test` cannot resolve. |
| `jsdom environment is available` | Vitest | `typeof document !== 'undefined'` and `typeof localStorage !== 'undefined'`. Fails under the default node environment, proving jsdom is actually configured rather than assumed. |
| `playwright serves the project root` | Playwright | Navigating to `/` returns a 200 and a document. Fails until the static web server is configured in `playwright.config.js`. |

## Implementation notes

- `devDependencies` only: `vitest`, `jsdom`, `@playwright/test`. Nothing lands in
  `dependencies`. The shipped app must remain installable-free.
- Scripts: `npm test` runs Vitest once (not watch), `npm run e2e` runs Playwright.
- Vitest `environment: 'jsdom'`, `include` limited to `tests/unit/**`.
- Playwright needs a static server for the app since there is no dev server. Use the built-in
  `webServer` option pointing at a zero-config static server, and set `testDir: 'tests/e2e'`.
  Do not introduce a bundler or framework to satisfy this.
- Add `node_modules/`, `test-results/`, and `playwright-report/` to `.gitignore`.
- `package.json` must declare `"type": "module"`. The app ships ES modules and the tests
  import them directly with no transpile step.

## Definition of done

- `npm test` runs and all unit tests pass.
- `npm run e2e` runs and all E2E tests pass.
- `git status` is clean of `node_modules`.
- Changelog entry appended.
- RED and GREEN commits pushed to `origin/main`.
