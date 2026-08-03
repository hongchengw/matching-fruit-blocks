import { test, expect } from '@playwright/test';

// The dev server hands out any file under the repo, so its containment is
// worth asserting rather than assuming. Dev tooling, never shipped, but it runs
// on a developer's machine with the developer's files behind it.

test.describe.configure({ mode: 'parallel' });

const cases = [
  ['plain traversal', '/../../../../etc/passwd'],
  ['encoded traversal', '/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'],
  ['encoded backslash traversal', '/..%5c..%5c..%5cwindows%5cwin.ini'],
  ['dotfile', '/.git/config'],
  ['nested dotfile', '/tests/../.git/HEAD'],
];

for (const [name, path] of cases) {
  test(`refuses to serve outside the app: ${name}`, async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}${path}`, { maxRedirects: 0 });
    expect(response.status(), `${path} was served`).toBeGreaterThanOrEqual(400);

    const body = await response.text();
    expect(body).not.toContain('root:');
    expect(body).not.toContain('[core]');
    expect(body).not.toContain('"devDependencies"');
  });
}

test('clamps traversal back into the app rather than escaping it', async ({
  request,
  baseURL,
}) => {
  // The defense is containment, not rejection. A path with enough ".." in it
  // resolves to the repo root and is served from there, which is the whole job
  // of a static server for this directory. What must never happen is the walk
  // continuing past the root.
  const response = await request.get(`${baseURL}/js/../../../../index.html`);
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("Farmer's Match");
});

test('still serves the app itself', async ({ request, baseURL }) => {
  // The guards above are only worth having if the server still works.
  for (const path of ['/', '/index.html', '/js/game.js', '/css/style.css']) {
    const response = await request.get(`${baseURL}${path}`);
    expect(response.status(), `${path} should be served`).toBe(200);
  }
});
