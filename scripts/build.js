/*
 * Deployment build.
 *
 * This is not a bundler, a transpiler, or a build step in the sense SPEC.md §11
 * forbids. Nothing here rewrites a single byte of the app: the files that land
 * in dist/ are the files in the repo, and the browser still loads hand-written
 * ES modules with no transform in between. What this does is *select*.
 *
 * The selection is the point (SPEC.md §11.2). This repository is a complete
 * description of the rig. SPEC.md states it outright, tasks/ and changelogs/
 * narrate building it, and tests/ names every sealed channel and how it is
 * sealed. §1 requires that the player never obtain proof they were cheated, and
 * a checkout deployed as-is serves that proof at /SPEC.md. Every seal inside
 * the game is worthless against a player who reads the design document.
 *
 * So the shipped tree is an allowlist. It is a list of directories rather than
 * of files, so a module added later ships automatically, while nothing outside
 * those directories can ever be picked up by accident.
 */
import { cp, mkdir, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Everything the browser needs, and nothing else. */
export const SHIPPED = Object.freeze(['index.html', 'css', 'js']);

/*
 * Resolved lazily and defensively. Under vitest's jsdom environment
 * import.meta.url is the document URL rather than a file path, so
 * fileURLToPath throws at module load and takes the whole import with it. The
 * same trap is documented in tests/unit/audio.test.js. Tests always pass `root`
 * explicitly; this only has to keep the module importable there.
 */
function projectRoot() {
  if (!import.meta.url.startsWith('file:')) return resolve(process.cwd());
  return resolve(fileURLToPath(new URL('..', import.meta.url)));
}

/**
 * Copy the shipped tree into `out`, replacing whatever was there.
 *
 * @param {{root?: string, out?: string}} options
 * @returns {Promise<string>} the output directory
 */
export async function build({ root = projectRoot(), out = join(root, 'dist') } = {}) {
  const from = resolve(root);
  const to = resolve(out);

  /*
   * The first thing this function does is delete `out`. Pointed at the repo, or
   * at anything containing it, that deletes the project. A build script is run
   * unattended by CI and by hosts, so it refuses rather than trusting its
   * caller. The trailing separator matters: a bare prefix test also matches a
   * sibling directory whose name merely starts with ours.
   */
  if (from === to || from.startsWith(to + sep)) {
    throw new Error(`refusing to build into ${to}, which contains the source tree`);
  }

  await rm(to, { recursive: true, force: true });
  await mkdir(to, { recursive: true });

  for (const entry of SHIPPED) {
    await cp(join(from, entry), join(to, entry), { recursive: true });
  }

  return to;
}

// Run as a script, not merely imported by the tests.
if (
  import.meta.url.startsWith('file:') &&
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  const out = await build();
  console.log(`built ${SHIPPED.join(', ')} into ${out}`);
}
