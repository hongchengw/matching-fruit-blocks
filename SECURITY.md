# Security

Findings from the audit run as part of task 22, and the standing posture of the project.
Current as of 2026-08-04. See [`SPEC.md`](SPEC.md) §11 and [`AGENTS.md`](AGENTS.md).

## What this thing is

Farmer's Match is a static, client-only browser game. It has:

- **no backend**, no API, no database, no session, no authentication;
- **no runtime dependencies** and no build step, so the shipped artifact is exactly the files
  in this repository;
- **no user-supplied input** anywhere. Nothing is typed, uploaded, pasted, or received;
- **no network access at runtime**, enforced by policy rather than convention (see below).

The consequence is that most of the usual web attack surface is not merely defended but
absent. There is no injection sink because there is no untrusted data, and no exfiltration
path because there is no egress.

The one piece of persistent state is a single `localStorage` key, `fm.state`, holding the
player's mute preference and their `rigLevel`. It is not sensitive, and it is scoped to the
origin.

## Content-Security-Policy

```
default-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
```

`connect-src 'none'` is the operative directive. `fetch`, `XMLHttpRequest`, `WebSocket`, and
`navigator.sendBeacon` are all refused, so `SPEC.md` §11's "no network calls of any kind at
runtime" is a property the browser enforces rather than a rule a reviewer has to notice being
broken. `default-src 'self'` covers the CDN-font prohibition in the same clause. `base-uri`
and `object-src` close the two injection routes `default-src` does not.

It ships as a `<meta http-equiv>` in `index.html`, so it applies however the app is served,
including from `file://` or a static host that sends no headers. `frame-ancestors` is ignored
inside a meta tag by specification, so `scripts/serve.js` additionally sends the whole policy
as a real response header.

**If you deploy this somewhere, send that header.** The meta tag covers everything except
clickjacking.

Verified by `tests/e2e/csp.spec.js`, 4 tests on each of three engines, including that a
third-party `fetch` raises an actual `connect-src` violation and that a full match still plays
with nothing refused.

## Application source review

No finding. Specifically checked and absent across `js/`, `css/`, and `index.html`:

| Looked for | Result |
|---|---|
| `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` | none. Every DOM write is `textContent` or `setAttribute`. Two unit tests use `innerHTML` to build a jsdom fixture from a literal; that is test scaffolding and ships nowhere |
| `eval`, `new Function`, string `setTimeout` | none in the app. Also none in the tests, as of task 22 |
| `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `import()` of a remote URL | none |
| inline event handlers, inline `<style>`, `style=` attributes | none |
| cookies, `postMessage`, `window.open`, `document.domain` | none |
| third-party script, font, or stylesheet | none. There are no third parties |

`localStorage` access is wrapped in `try`/`catch` throughout, since private browsing can throw
on access and a crash on load would be both a bug and a very loud tell. `loadState` reads two
known keys and range-checks them, so a corrupt or hostile value falls back to the documented
default and overwrites rather than propagating. There is no prototype-pollution path: nothing
merges parsed JSON into an object, and no key is taken from data.

## Dependencies

**Runtime: clean.** `npm audit --omit=dev` reports **0 vulnerabilities**, which is the expected
answer, since there are no runtime dependencies to audit.

**Development: 5 advisories, all in the vitest/vite chain, none reaching the shipped app.**

| Severity | Package | Advisory |
|---|---|---|
| critical | `vitest` | Arbitrary file read and execute while the Vitest UI server is listening ([GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp)) |
| high | `vite` | `server.fs.deny` bypass via Windows alternate paths ([GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff)) |
| moderate | `vite` | Path traversal in optimized-deps `.map` handling ([GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9)) |
| moderate | `vite` | `launch-editor` NTLMv2 hash disclosure via UNC paths on Windows ([GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3)) |
| moderate | `esbuild` | Any site can issue requests to the dev server and read the response ([GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)) |

Installed: `vitest` 2.1.9, `vite` 5.4.21, `esbuild` 0.21.5.

**Status: knowingly deferred.** Every one of these requires a dev server this project never
starts. The critical advisory needs the Vitest UI, which nothing here launches; `npm test` runs
`vitest run` and exits. None of them can affect a user of the game, because none of these
packages are in it.

There is no non-breaking fix. `npm audit fix` offers only `--force`, which installs
`vitest@4`, two majors up, with 163 unit tests riding on it. Doing that as an unattended
side effect of a security cleanup is a worse risk than the advisories it closes.

**Recommended follow-up:** do the vitest major upgrade deliberately, as its own task, run
against the full suite, rather than folding it into other work.

## Development server

`scripts/serve.js` exists to serve this directory to Playwright. Three real problems were found
and fixed in `21adcb8`:

1. **It listened on every interface**, making the whole checkout visible to anything on the
   same network. It now binds `127.0.0.1`.
2. **It served dotfiles.** `/.git/config` handed over the repository, and with it the full
   history. Any path segment below the root starting with `.` is now refused.
3. **It normalized the request path before decoding it**, so `%2e%2e%2f` passed the traversal
   guard as an opaque filename that `path.normalize` had no opinion about, then became `../`
   afterward. It now decodes first, and the containment check is separator-aware, since a bare
   `startsWith` also accepts a sibling directory whose name merely begins with the root's.

Covered by `tests/e2e/server-hardening.spec.js`, 7 tests on each of three engines.

**Deliberate non-goal:** traversal that resolves back *inside* the repository is still served.
That is what a static server for a directory is for. What must never happen is the walk
continuing past the root, and that is what the tests assert.

This server is a development tool. It has no authentication, no rate limiting, and no logging,
and it is not intended to face the internet.

## Accepted exposure: the test hooks

`?fm-test=1` exposes the whole board through `window.__fmTest`, and `&fm-rig=<n>` overrides the
rig threshold when used alongside it. There is no build step to strip them, so they ship.

**This is accepted.** The reasoning:

- They are not a vulnerability. The board's contents already live in the page's own memory, and
  anyone willing to open a devtools console can read them without any hook at all. The hook
  makes a thing that was already reachable convenient, not a thing that was secret possible.
- They expose nothing about anyone but the player, on their own machine, in their own browser.
  There is no other user's data to reach.
- Nothing in the UI mentions either parameter, and neither is reachable in normal play.
- Every end-to-end playthrough test depends on the hook to know where the true pairs are.
  Removing it would mean removing the tests that prove the game is winnable before the rig arms
  and unwinnable after.

`tests/e2e/honest-play.spec.js` asserts the hook is absent without the parameter.

Note that a player who finds `&fm-rig=999` can play the honest game indefinitely for as long as
they keep the parameter in the URL. That is not a security matter, and it is not an escape from
the rig either, which `SPEC.md` §2.8 requires there be none of within a round. The parameter is
never written to storage: since task 25, `reset` does not write `rigLevel` at all, and
`sanitizeRigLevel` clamps whatever is read back to 0 through 5, so an inflated threshold cannot
outlive the tab it was typed into.

## Reporting

This is a portfolio project with no deployment and no users. If you find something anyway,
open an issue.
