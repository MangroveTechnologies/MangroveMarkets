import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('./complete-npm-release.mjs', import.meta.url));
const preload = fileURLToPath(new URL('./fixtures/complete-npm-preload.mjs', import.meta.url));
const metadata = JSON.parse(readFileSync(new URL('../packages/sdk/package.json', import.meta.url), 'utf8'));

function run(scenario, acceptedUpload = false) {
  const directory = mkdtempSync(join(tmpdir(), 'markets-release-cli-'));
  try {
    mkdirSync(join(directory, '.git'));
    const bytes = Buffer.from('opaque archive bytes bound by actual pack/registry verification');
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    const filename = `mangrove-ai-markets-${metadata.version}.tgz`;
    writeFileSync(join(directory, filename), bytes);
    writeFileSync(join(directory, 'pack.json'), JSON.stringify([{ name: metadata.name, version: metadata.version,
      filename, integrity, size: bytes.length }]));
    const source = 'a'.repeat(40), observed = join(directory, 'observed.json');
    const fixture = join(directory, 'fixture.json');
    writeFileSync(fixture, JSON.stringify({ source, observed, archive: bytes.toString('base64'),
      scenario, tagSha: 'b'.repeat(40), published: { name: metadata.name, version: metadata.version, gitHead: source,
        repository: { url: 'git+https://github.com/MangroveTechnologies/MangroveMarkets.git', directory: 'packages/sdk' },
        dist: { integrity, tarball: `https://registry.npmjs.org/@mangrove-ai/markets/-/markets-${metadata.version}.tgz` } } }));
    const child = spawnSync(process.execPath, ['--import', preload, cli, 'complete', join(directory, 'pack.json'),
      String(acceptedUpload)], { cwd: directory, encoding: 'utf8', timeout: 10000,
      env: { ...process.env, MARKETS_RELEASE_FIXTURE: fixture, GH_TOKEN: 'offline-fixture', RUNNER_TEMP: directory,
        GITHUB_REPOSITORY: 'MangroveTechnologies/MangroveMarkets', GITHUB_EVENT_NAME: 'workflow_dispatch',
        GITHUB_REF: 'refs/heads/main', GITHUB_WORKFLOW_REF: 'MangroveTechnologies/MangroveMarkets/.github/workflows/publish.yaml@refs/heads/main',
        GITHUB_SHA: source, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1' } });
    assert.equal(child.error, undefined);
    const proof = JSON.parse(readFileSync(observed, 'utf8'));
    assert.equal(proof.writes, 0);
    assert.ok(proof.requests.every((request) => request.method === 'GET'));
    assert.equal(proof.commands.filter(([command, argument]) => command === 'npm' && argument !== 'root').length, 0);
    return { child, proof };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('real completion CLI waits through staggered metadata/archive404s then reuses exact GitHub objects', () => {
  const { child, proof } = run('delayed', true);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(proof.clock, 180000);
  assert.ok(child.stdout.includes('typescript-sdk-v'));
});
test('real completion CLI repeated matching-artifact completion makes no publication writes', () => {
  for (let count = 0; count < 2; count++) assert.equal(run('matching').child.status, 0);
});
for (const scenario of ['timeout', 'auth', 'rate', 'network', 'source-conflict', 'corrupt', 'tag-conflict']) {
  test(`real completion CLI aborts ${scenario} without writes`, () => {
    const { child, proof } = run(scenario, true);
    assert.equal(child.status, 1);
    if (scenario === 'timeout') assert.equal(proof.clock, 600000);
    if (scenario !== 'tag-conflict') assert.equal(proof.requests.filter(({ url }) => url.includes('/git/')).length, 0);
  });
}
test('real completion CLI never waits for an unaccepted404', () => {
  const { child, proof } = run('timeout');
  assert.equal(child.status, 1);
  assert.equal(proof.clock, 0);
});
