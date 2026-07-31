# Agent Instructions

Working agreement for anyone, human or agent, touching this repo.

## SPEC.md is the source of truth

`SPEC.md` describes every behavior of the app. Any behavior change lands in the spec
first, then in code. If code and spec disagree, the spec wins and the code is a bug.
Never change behavior to match code that drifted.

If a task file in `tasks/` disagrees with `SPEC.md`, `SPEC.md` wins. Amend `SPEC.md`
first, then the task file, then proceed.

## The rig is not a bug

This game is intentionally unwinnable after the rig arms. Do not "fix" it. Do not add a
win screen. Do not make the reroll fairer, the reshuffle visible, or the mismatch sound
distinctive. `SPEC.md` §1 and §2 give the rationale for every one of those choices.

Four detection channels are deliberately sealed: visual, audio, tally, persistence. Any
change that reopens one is a regression even if every test still passes. `SPEC.md` §10.3
lists the tests that guard them.

## The per-task loop

Every task in `tasks/` follows the same cycle. No shortcuts.

```
1. Read SPEC.md and the task file
2. Write the failing tests the task file lists
3. Run them. Confirm RED.
   -> A test that passes before implementation is misspecified. Fix the test.
4. Commit the tests (RED commit)
5. Implement
6. Run the full suite, not just the new tests. Confirm GREEN.
7. Append a changelogs/CHANGELOGS.md entry
8. Commit the implementation (GREEN commit)
9. Push to origin/main
```

Do not start a task whose dependencies, listed in the task file and in `tasks/README.md`,
are incomplete.

## Commits

- Two commits per task in `tasks/`: one RED, one GREEN. The git log must show the tests
  landing before the code that satisfies them.
  - RED: `test(<scope>): add failing specs for <thing>`
  - GREEN: `feat(<scope>): <thing>`, or `fix(...)` / `refactor(...)` as appropriate
- Conventional Commits format, for example `feat(build): add dependency-free bundler`.
- Write every commit message with the `git-commit-formatter` skill. It owns the format, so do not
  hand-roll a message and hope it conforms.
- **Never add a `Co-Authored-By` trailer, and never list Claude as a co-author on any commit.**
- Append a `changelogs/CHANGELOGS.md` entry per task, newest first, with the real
  current time in EDT.
- Push to `origin/main` after each task.

## Tests

```
npm test        # vitest + jsdom, unit
npm run e2e     # playwright, browser
```

Both must pass before a GREEN commit. Task 01 establishes this tooling; until it lands
there is nothing to run.

- **Never commit with tests red, skipped, or unrun.**
- **Never weaken a test to make it pass.** If the test is wrong, fix the test and say so in
  the changelog. If the implementation is wrong, fix the implementation.
- **Never mark a task done on a partial implementation.** Blocked is a valid state.
  Silently incomplete is not.

## Changelog

Every change to this repo gets an entry in `changelogs/CHANGELOGS.md`. Newest first.

```
## YYYY-MM-DD HH:MM EDT | <conventional-commit-style summary>
<1 to 3 lines: what changed, which tests now cover it, anything deferred>
```

Timestamps are EDT, never UTC and never the machine's local time. Get one with:

```
TZ=America/New_York date "+%Y-%m-%d %H:%M EDT"
```

## Constraints

- **No runtime dependencies.** `devDependencies` only. The shipped app is vanilla HTML, CSS,
  and ES modules with no build step, no bundler, no framework (`SPEC.md` §11).
- **No runtime network requests.** That includes CDN fonts. Fonts are embedded locally or
  the monospace fallback is used.

## Documented exceptions

- Documentation-only changes (`SPEC.md`, `tasks/`, `AGENTS.md`, `README.md`) are exempt from
  the test gate, since there is nothing to test. They are **not** exempt from the changelog
  entry or the commit and push protocol.
- Documentation-only changes are a single commit, not a RED/GREEN pair.

## Delegation

Whether to hand a task to a sub-agent is a runtime judgment call made by whoever is
executing. Task files intentionally carry no agent hints. If you delegate, the delegate
follows this same loop, and you verify their tests actually ran green before the GREEN
commit lands.

## Style

- Prioritize simplicity and readability over clever solutions.
- Start minimal, verify it works, then add complexity.
- Prefer functional and stateless code where it improves clarity.
- Keep core logic clean and push implementation details to the edges.
- Keep indentation, naming, and patterns consistent across the codebase.
- No em-dashes in prose.
