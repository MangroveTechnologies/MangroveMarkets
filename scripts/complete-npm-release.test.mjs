import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { PACKAGE_NAME } from './check-npm-release.mjs';
import { REPOSITORY, REPOSITORY_URL, integrity, validateContext, packEvidence,
  download, verifyPublished, releaseBody, completeGithubRelease, githubClient, verifyPreparedManifest, releaseVersion } from './complete-npm-release.mjs';

const source = 'a'.repeat(40), tagSha = 'b'.repeat(40);
const metadata = { name: PACKAGE_NAME, version: '0.4.0', repository: { url: REPOSITORY_URL, directory: 'packages/sdk' } };
const env = { GITHUB_REPOSITORY: REPOSITORY, GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main',
  GITHUB_SHA: source, GITHUB_WORKFLOW_REF: `${REPOSITORY}/.github/workflows/publish.yaml@refs/heads/main`,
  GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2' };
const run = { id: 123, run_attempt: 2, repository: { full_name: REPOSITORY }, event: 'push',
  path: '.github/workflows/publish.yaml', head_branch: 'main', head_sha: source, status: 'in_progress' };
const context = { source, version: '0.4.0', tag: 'typescript-sdk-v0.4.0' };
const bytes = Buffer.from('synthetic archive bytes, not an npm package');
const pack = [{ name: PACKAGE_NAME, version: '0.4.0', filename: 'mangrove-ai-markets-0.4.0.tgz',
  integrity: integrity(bytes), size: bytes.length }];
const evidence = packEvidence(pack, bytes, pack[0].filename, '0.4.0');
const tarball = 'https://registry.npmjs.org/@mangrove-ai/markets/-/markets-0.4.0.tgz';
const published = { ...metadata, gitHead: source, repository: { ...metadata.repository, url: `git+${REPOSITORY_URL}.git` },
  dist: { integrity: evidence.integrity, tarball } };
const verified = { package: PACKAGE_NAME, version: '0.4.0', source, tarball, ...evidence };
const ref = { ref: `refs/tags/${context.tag}`, object: { sha: tagSha, type: 'tag' } };
const tag = { sha: tagSha, tag: context.tag, message: `MangroveMarkets TypeScript SDK 0.4.0\nSource: ${source}\n`,
  object: { type: 'commit', sha: source } };
const release = { tag_name: context.tag, name: 'MangroveMarkets TypeScript SDK 0.4.0', body: releaseBody(verified),
  draft: false, prerelease: false, html_url: `${REPOSITORY_URL}/releases/tag/${context.tag}` };

function registry(body = published, archive = bytes, status = 200) {
  const calls = [];
  return { calls, fetch: async (url, options) => {
    calls.push({ url, options });
    return url === tarball ? { status: 200, body: Readable.from([archive]) }
      : { status, json: async () => body };
  } };
}
function githubFixture({ existingTag = true, existingRelease = true, refBody = ref, tagBody = tag,
  releaseBodyValue = release, failWrite = false } = {}) {
  const calls = [];
  let tagExists = existingTag, releaseExists = existingRelease;
  return { calls, api: async (method, path, body) => {
    calls.push({ method, path, body });
    if (method === 'POST') {
      if (failWrite) throw new Error('Ambiguous simulated write');
      if (path === '/git/tags') return { status: 201, data: { sha: tagSha } };
      if (path === '/git/refs') { tagExists = true; return { status: 201, data: ref }; }
      if (path === '/releases') { releaseExists = true; return { status: 201, data: release }; }
    }
    if (path.startsWith('/git/ref/')) return { status: tagExists ? 200 : 404, data: refBody };
    if (path.startsWith('/git/tags/')) return { status: 200, data: tagBody };
    if (path.startsWith('/releases/tags/')) return { status: releaseExists ? 200 : 404, data: releaseBodyValue };
    throw new Error('Unexpected request');
  } };
}

test('genuine main push/current run/clean normal checkout is accepted', () => {
  assert.deepEqual(validateContext(env, source, true, true, run, { sha: source }, metadata), context);
});
for (const [key, value] of Object.entries({ GITHUB_REPOSITORY: 'other/repo', GITHUB_EVENT_NAME: 'release',
  GITHUB_REF: 'refs/heads/feature', GITHUB_SHA: 'no-sha', GITHUB_RUN_ID: '1\n', GITHUB_RUN_ATTEMPT: '9',
  GITHUB_WORKFLOW_REF: `${REPOSITORY}/other.yaml@refs/heads/main` })) {
  test(`native context rejects ${key} mismatch`, () => {
    assert.throws(() => validateContext({ ...env, [key]: value }, source, true, true, run, { sha: source }, metadata));
  });
}
test('foreign package, wrong head, dirty/worktree checkout and moving main stop before publishing', () => {
  for (const args of [
    [env, 'c'.repeat(40), true, true, run, { sha: source }, metadata],
    [env, source, false, true, run, { sha: source }, metadata],
    [env, source, true, false, run, { sha: source }, metadata],
    [env, source, true, true, run, { sha: 'c'.repeat(40) }, metadata],
    [env, source, true, true, run, { sha: source }, { ...metadata, name: '@mangrove-ai/sdk' }],
    [env, source, true, true, run, { sha: source }, { ...metadata, version: '0.3.0' }],
  ]) assert.throws(() => validateContext(...args));
});
test('actual run repository, workflow, event, branch, SHA and attempt must all match', () => {
  for (const patch of [{ repository: { full_name: 'other/repo' } }, { path: 'other.yaml' }, { event: 'release' },
    { head_branch: 'feature' }, { head_sha: 'c'.repeat(40) }, { run_attempt: 1 }, { status: 'completed' }, { id: 999 }]) {
    assert.throws(() => validateContext(env, source, true, true, { ...run, ...patch }, { sha: source }, metadata));
  }
});
test('pack evidence uses real base64 SHA512 SRI and actual archive bytes', () => {
  assert.deepEqual(packEvidence(pack, bytes, pack[0].filename, '0.4.0'), evidence);
  assert.equal(evidence.integrity, `sha512-${Buffer.from(evidence.integrity.slice(7), 'base64').toString('base64')}`);
  for (const patch of [{ name: '@mangrove-ai/sdk' }, { version: '0.3.0' }, { size: 0 },
    { filename: '../archive.tgz' }, { integrity: 'sha512-' + 'a'.repeat(128) }]) {
    assert.throws(() => packEvidence([{ ...pack[0], ...patch }], bytes, pack[0].filename, '0.4.0'));
  }
  assert.throws(() => packEvidence(pack, Buffer.from('modified'), pack[0].filename, '0.4.0'));
});
test('registry gitHead, repository, exact URL and downloaded bytes bind the source archive', async () => {
  const r = registry();
  assert.deepEqual(await verifyPublished(metadata, source, evidence, r.fetch), verified);
  assert.equal(r.calls.length, 2);
  assert.ok(r.calls.every(({ options }) => options.redirect === 'error' && options.signal instanceof AbortSignal));
});
for (const patch of [{ name: '@mangrove-ai/sdk' }, { version: '0.3.0' }, { gitHead: undefined },
  { gitHead: 'c'.repeat(40) }, { repository: { url: REPOSITORY_URL } },
  { dist: { integrity: evidence.integrity, tarball: 'https://foreign.example/archive.tgz' } },
  { dist: { tarball, integrity: 'sha512-wrong' } }]) {
  test(`registry mismatch fails closed: ${Object.keys(patch).join(',')}`, async () => {
    const r = registry({ ...published, ...patch });
    await assert.rejects(verifyPublished(metadata, source, evidence, r.fetch));
    assert.equal(r.calls.length, 1);
  });
}
for (const status of [404, 401, 403, 429, 500]) {
  test(`postpublication HTTP${status} cannot create a release`, async () => {
    const r = registry(published, bytes, status);
    await assert.rejects(verifyPublished(metadata, source, evidence, r.fetch));
    assert.equal(r.calls.length, 1);
  });
}
test('corrupt archive, oversized stream and transport failure stop completion', async () => {
  await assert.rejects(verifyPublished(metadata, source, evidence, registry(published, Buffer.from('corrupt')).fetch));
  await assert.rejects(download({ status: 200, body: Readable.from([Buffer.alloc(20 * 1024 * 1024 + 1)]) }));
  await assert.rejects(verifyPublished(metadata, source, evidence, async () => { throw new Error('network'); }));
});
test('new tag is annotated, source-bound and read back before a published non-latest release', async () => {
  const g = githubFixture({ existingTag: false, existingRelease: false });
  assert.equal((await completeGithubRelease(context, verified, g.api)).release, release.html_url);
  const writes = g.calls.filter(({ method }) => method === 'POST');
  assert.deepEqual(writes.map(({ path }) => path), ['/git/tags', '/git/refs', '/releases']);
  assert.equal(writes[0].body.object, source);
  assert.equal(writes[0].body.type, 'commit');
  assert.equal(writes[1].body.sha, tagSha);
  assert.equal(writes[2].body.make_latest, 'false');
  assert.equal(writes[2].body.draft, false);
  assert.equal(writes[2].body.target_commitish, source);
});
test('exact completed release is idempotent with no writes or duplicate assets', async () => {
  const g = githubFixture();
  await completeGithubRelease(context, verified, g.api);
  assert.ok(g.calls.every(({ method }) => method === 'GET'));
});
test('published npm plus matching existing tag can recover missing GitHub release only', async () => {
  const g = githubFixture({ existingRelease: false });
  await completeGithubRelease(context, verified, g.api);
  assert.deepEqual(g.calls.filter(({ method }) => method === 'POST').map(({ path }) => path), ['/releases']);
});
for (const patch of [{ object: { type: 'commit', sha: source } }, { ref: 'refs/tags/other' }]) {
  test('conflicting or lightweight tag never overwritten', async () => {
    const g = githubFixture({ refBody: { ...ref, ...patch } });
    await assert.rejects(completeGithubRelease(context, verified, g.api));
    assert.ok(g.calls.every(({ method }) => method === 'GET'));
  });
}
for (const patch of [{ object: { type: 'commit', sha: 'c'.repeat(40) } }, { message: 'wrong' }, { sha: 'c'.repeat(40) }]) {
  test('annotated tag conflict stops release creation', async () => {
    const g = githubFixture({ tagBody: { ...tag, ...patch }, existingRelease: false });
    await assert.rejects(completeGithubRelease(context, verified, g.api));
    assert.ok(g.calls.every(({ method }) => method === 'GET'));
  });
}
for (const patch of [{ draft: true }, { prerelease: true }, { body: 'wrong' }, { name: 'wrong' },
  { tag_name: 'other' }, { html_url: 'https://foreign.example' }]) {
  test(`conflicting existing GitHub release ${Object.keys(patch)} cannot be adopted`, async () => {
    const g = githubFixture({ releaseBodyValue: { ...release, ...patch } });
    await assert.rejects(completeGithubRelease(context, verified, g.api));
    assert.ok(g.calls.every(({ method }) => method === 'GET'));
  });
}
test('ambiguous API write stops immediately, without retry or overwrite', async () => {
  const g = githubFixture({ existingTag: false, failWrite: true });
  await assert.rejects(completeGithubRelease(context, verified, g.api));
  assert.equal(g.calls.filter(({ method }) => method === 'POST').length, 1);
});
test('GitHub client is bounded, authenticated and rejects API failures without echoing tokens', async () => {
  assert.throws(() => githubClient(''));
  let call;
  const api = githubClient('synthetic-token', async (url, options) => {
    call = { url, options }; return { status: 404 };
  });
  assert.deepEqual(await api('GET', '/git/ref/tags/absent', undefined, [200, 404]), { status: 404, data: null });
  assert.equal(call.options.headers['X-GitHub-Api-Version'], '2026-03-10');
  assert.ok(call.options.signal instanceof AbortSignal);
  assert.equal(call.options.redirect, 'error');
  await assert.rejects(api('POST', '/git/refs', {}), (error) => !error.message.includes('synthetic-token'));
});


test('existing publication can resume on an advancing main only with exact ancestor proof', () => {
  const newerMain = { sha: 'c'.repeat(40) };
  const proof = { status: 'ahead', base_commit: { sha: source }, merge_base_commit: { sha: source } };
  assert.deepEqual(validateContext(env, source, true, true, run, newerMain, metadata, true, proof), context);
  assert.throws(() => validateContext(env, source, true, true, run, newerMain, metadata, false, proof));
  for (const invalid of [null, { ...proof, status: 'diverged' },
    { ...proof, base_commit: { sha: 'd'.repeat(40) } }, { ...proof, merge_base_commit: { sha: 'd'.repeat(40) } }]) {
    assert.throws(() => validateContext(env, source, true, true, run, newerMain, metadata, true, invalid));
  }
});
test('actual npm prepared manifest must contain the genuine source gitHead before publication', () => {
  assert.doesNotThrow(() => verifyPreparedManifest(published, source, '0.4.0'));
  for (const patch of [{ gitHead: undefined }, { gitHead: 'd'.repeat(40) }, { name: '@mangrove-ai/sdk' },
    { repository: { url: REPOSITORY_URL, directory: 'packages/sdk' } }]) {
    assert.throws(() => verifyPreparedManifest({ ...published, ...patch }, source, '0.4.0'));
  }
});

test('later reviewed Markets versions do not need a hardcoded workflow edit', () => {
  for (const version of ['0.4.1', '0.5.0', '1.0.0']) {
    assert.equal(releaseVersion(version), true);
    assert.equal(validateContext(env, source, true, true, run, { sha: source }, { ...metadata, version }).version, version);
    assert.doesNotThrow(() => verifyPreparedManifest({ ...published, version }, source, version));
  }
  for (const version of ['0.3.0', '0.04.0', '0.4.0\n', '0.4.0-beta', 'foreign']) assert.equal(releaseVersion(version), false);
});

test('current-main manual recovery uses committed identity and actual workflow_dispatch run', () => {
  const manualEnv = { ...env, GITHUB_EVENT_NAME: 'workflow_dispatch' };
  const manualRun = { ...run, event: 'workflow_dispatch' };
  assert.deepEqual(validateContext(manualEnv, source, true, true, manualRun, { sha: source }, metadata), context);
  assert.throws(() => validateContext(manualEnv, source, true, true, run, { sha: source }, metadata));
  assert.throws(() => validateContext(env, source, true, true, manualRun, { sha: source }, metadata));
});
test('manual feature refs and spoofed source fail; advanced main permits only verified-artifact recovery', () => {
  const manualEnv = { ...env, GITHUB_EVENT_NAME: 'workflow_dispatch' };
  const manualRun = { ...run, event: 'workflow_dispatch' };
  for (const patch of [{ GITHUB_REF: 'refs/heads/feature' },
    { GITHUB_WORKFLOW_REF: `${REPOSITORY}/.github/workflows/publish.yaml@refs/heads/feature` },
    { GITHUB_SHA: 'c'.repeat(40) }]) {
    assert.throws(() => validateContext({ ...manualEnv, ...patch }, source, true, true, manualRun, { sha: source }, metadata));
  }
  const proof = { status: 'ahead', base_commit: { sha: source }, merge_base_commit: { sha: source } };
  assert.throws(() => validateContext(manualEnv, source, true, true, manualRun, { sha: 'c'.repeat(40) }, metadata, false, proof));
  assert.deepEqual(validateContext(manualEnv, source, true, true, manualRun, { sha: 'c'.repeat(40) }, metadata, true, proof), context);
  assert.throws(() => validateContext(manualEnv, source, true, true, manualRun, { sha: 'c'.repeat(40) }, metadata, true,
    { ...proof, merge_base_commit: { sha: 'd'.repeat(40) } }));
});


test('only a just-accepted native upload waits through temporary registry processing404s', async () => {
  let calls = 0, sleeps = 0, clock = 0;
  const fetchVersion = async (url) => {
    if (url === tarball) return { status: 200, body: Readable.from([bytes]) };
    return ++calls <= 2 ? { status: 404 } : { status: 200, json: async () => published };
  };
  const result = await verifyPublished(metadata, source, evidence, fetchVersion,
    { acceptedUpload: true, now: () => clock, wait: async (ms) => { sleeps++; clock += ms; } });
  assert.deepEqual(result, verified);
  assert.equal(calls, 3);
  assert.equal(sleeps, 2);
  assert.equal(clock, 60000);
});
test('never-visible accepted upload stops at the finite ten-minute deadline with no writes', async () => {
  let calls = 0, clock = 0;
  await assert.rejects(verifyPublished(metadata, source, evidence, async () => { calls++; return { status: 404 }; },
    { acceptedUpload: true, now: () => clock, wait: async (ms) => { clock += ms; } }));
  assert.equal(clock, 600000);
  assert.equal(calls, 20);
});
test('unaccepted404 and preflight-style reads do not wait or turn into upload retries', async () => {
  let calls = 0, sleeps = 0;
  await assert.rejects(verifyPublished(metadata, source, evidence, async () => { calls++; return { status: 404 }; },
    { wait: async () => { sleeps++; } }));
  assert.equal(calls, 1);
  assert.equal(sleeps, 0);
});
for (const status of [401, 403, 429, 500]) {
  test(`accepted upload does not retry HTTP${status}`, async () => {
    let calls = 0, sleeps = 0;
    await assert.rejects(verifyPublished(metadata, source, evidence, async () => { calls++; return { status }; },
      { acceptedUpload: true, wait: async () => { sleeps++; } }));
    assert.equal(calls, 1);
    assert.equal(sleeps, 0);
  });
}
test('accepted upload does not retry network failures or conflicting metadata after processing', async () => {
  let sleeps = 0, calls = 0, clock = 0;
  await assert.rejects(verifyPublished(metadata, source, evidence, async () => { calls++; throw new Error('network'); },
    { acceptedUpload: true, wait: async () => { sleeps++; } }));
  assert.equal(calls, 1);
  assert.equal(sleeps, 0);
  calls = 0;
  await assert.rejects(verifyPublished(metadata, source, evidence, async () => ++calls === 1
    ? { status: 404 } : { status: 200, json: async () => ({ ...published, gitHead: 'f'.repeat(40) }) },
  { acceptedUpload: true, now: () => clock, wait: async (ms) => { sleeps++; clock += ms; } }));
  assert.equal(calls, 2);
  assert.equal(sleeps, 1);
});

test('accepted upload shares one visibility deadline across metadata and staggered tarball processing', async () => {
  let metadataCalls = 0, tarballCalls = 0, clock = 0;
  const result = await verifyPublished(metadata, source, evidence, async (url, options) => {
    assert.equal(options.method, 'GET');
    if (url === tarball) return ++tarballCalls === 1 ? { status: 404 } : { status: 200, body: Readable.from([bytes]) };
    return ++metadataCalls === 1 ? { status: 404 } : { status: 200, json: async () => published };
  }, { acceptedUpload: true, now: () => clock, wait: async (ms) => { clock += ms; } });
  assert.deepEqual(result, verified);
  assert.equal(metadataCalls, 2);
  assert.equal(tarballCalls, 2);
  assert.equal(clock, 60000);
});
test('tarball404 cannot start a second visibility budget after metadata consumes the deadline', async () => {
  let metadataCalls = 0, tarballCalls = 0, clock = 0;
  await assert.rejects(verifyPublished(metadata, source, evidence, async (url) => {
    if (url === tarball) { tarballCalls++; return { status: 404 }; }
    return ++metadataCalls < 20 ? { status: 404 } : { status: 200, json: async () => published };
  }, { acceptedUpload: true, now: () => clock, wait: async (ms) => { clock += ms; } }));
  assert.equal(clock, 600000);
  assert.equal(tarballCalls, 1);
});

test('processing404 stream is cancelled before waiting and requesting again', async () => {
  let calls = 0, cancelled = false, clock = 0;
  await verifyPublished(metadata, source, evidence, async (url) => {
    if (url === tarball) return { status: 200, body: Readable.from([bytes]) };
    return ++calls === 1 ? { status: 404, body: { cancel: async () => { cancelled = true; } } }
      : { status: 200, json: async () => published };
  }, { acceptedUpload: true, now: () => clock, wait: async (ms) => { assert.equal(cancelled, true); clock += ms; } });
  assert.equal(cancelled, true);
});
