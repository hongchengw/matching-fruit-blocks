import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { build, SHIPPED } from '../../scripts/build.js';

// Resolved from the project root, matching tests/unit/audio.test.js: under the
// jsdom environment import.meta.url is the document URL, not a file path.
const ROOT = resolve(process.cwd());

const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );

describe('the deployment build', () => {
  let out;

  beforeAll(async () => {
    out = join(await mkdtemp(join(tmpdir(), 'fm-build-')), 'dist');
    await build({ root: ROOT, out });
  });

  afterAll(async () => {
    await rm(out, { recursive: true, force: true });
  });

  it('ships the page, the styles, and every module the app imports', async () => {
    const shipped = [
      'index.html',
      'css/style.css',
      'js/game.js',
      'js/sprites.js',
      'js/palette.js',
      'js/audio.js',
      'js/ambience.js',
    ];

    for (const file of shipped) {
      expect(await exists(join(out, file)), `${file} is missing from the build`).toBe(true);
    }
  });

  /*
   * The reason this build step exists at all.
   *
   * SPEC.md §1 requires the player never obtain proof they were cheated, and
   * this repository is nothing but that proof: SPEC.md states the rig outright,
   * tasks/ and changelogs/ walk through building it, and tests/ names every
   * sealed channel. Deploying the checkout would hand a curious player the
   * whole design document at /SPEC.md. No amount of care inside the game
   * survives that, so the build ships the app and only the app.
   */
  it('never ships the documents that describe the rig', async () => {
    const secrets = [
      'SPEC.md',
      'AGENTS.md',
      'SECURITY.md',
      'README.md',
      'changelogs',
      'tasks',
      'tests',
      'scripts',
      'package.json',
      'playwright.config.js',
      'vitest.config.js',
    ];

    for (const entry of secrets) {
      expect(await exists(join(out, entry)), `${entry} leaked into the build`).toBe(false);
    }
  });

  it('copies whole directories, so a new module ships without being listed', () => {
    expect(SHIPPED).toContain('js');
    expect(SHIPPED).toContain('css');
  });

  /*
   * `build` clears its output directory first. Pointed at the repo that would
   * delete the project, so it refuses rather than trusting the caller.
   */
  it('refuses an output directory that would swallow the source', async () => {
    await expect(build({ root: ROOT, out: ROOT })).rejects.toThrow(/refus/i);
    await expect(build({ root: ROOT, out: join(ROOT, '..') })).rejects.toThrow(/refus/i);
  });
});

describe('the vercel deployment config', () => {
  let config;

  beforeAll(async () => {
    config = JSON.parse(await readFile(join(ROOT, 'vercel.json'), 'utf8'));
  });

  it('builds with the deployment build and serves its output', () => {
    expect(config.buildCommand).toMatch(/scripts\/build\.js/);
    expect(config.outputDirectory).toBe('dist');
  });

  /*
   * SPEC.md §11.1 is enforced by a policy, not by review, and a policy that
   * only holds on the dev server is not enforcement. The header the host sends
   * has to be the one the suite has been running against all along.
   */
  it('sends the same policy the dev server does', async () => {
    const source = await readFile(join(ROOT, 'scripts', 'serve.js'), 'utf8');

    const header = config.headers
      ?.flatMap((rule) => rule.headers ?? [])
      .find((h) => h.key.toLowerCase() === 'content-security-policy');

    expect(header, 'vercel.json sends no Content-Security-Policy').toBeDefined();

    const directives = [
      "default-src 'self'",
      "connect-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
    ];

    for (const directive of directives) {
      expect(header.value, `production policy is missing ${directive}`).toContain(directive);
      expect(source, `dev server policy is missing ${directive}`).toContain(directive);
    }
  });

  it('applies the policy to every route, not just the document', () => {
    const paths = config.headers.map((rule) => rule.source);
    expect(paths.some((path) => path === '/(.*)' || path === '/:path*')).toBe(true);
  });
});
