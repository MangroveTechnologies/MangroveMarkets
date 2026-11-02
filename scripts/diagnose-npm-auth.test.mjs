import { test } from 'node:test';
import assert from 'node:assert/strict';
import { credentialSummary, tokenSummary, packageSummary, readOnlyRegistry, guard, lifecycleSummary, STATUS_PATH } from './diagnose-npm-auth.mjs';
const token = 'npm_SYNTHETIC_CREDENTIAL_CANARY_12345';
const env = { NODE_AUTH_TOKEN: token, RUNNER_TEMP: '/fixture', GITHUB_REPOSITORY: 'MangroveTechnologies/MangroveMarkets',
  GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/codex/markets-npm-auth-diagnostics',
  GITHUB_WORKFLOW_REF: 'MangroveTechnologies/MangroveMarkets/.github/workflows/publish.yaml@refs/heads/codex/markets-npm-auth-diagnostics',
  GITHUB_SHA: 'a'.repeat(40), GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1' };
const run = { id: 123, head_sha: env.GITHUB_SHA, head_branch: 'codex/markets-npm-auth-diagnostics',
  event: 'workflow_dispatch', path: '.github/workflows/publish.yaml', repository: { full_name: env.GITHUB_REPOSITORY },
  run_attempt: 1, status: 'in_progress' };
test('only exact native diagnostic feature source and actual run are accepted', () => {
  assert.doesNotThrow(() => guard(env, run));
  for (const patch of [{ GITHUB_REF: 'refs/heads/main' }, { GITHUB_EVENT_NAME: 'push' },
    { GITHUB_SHA: 'b'.repeat(40) }, { GITHUB_RUN_ID: '456' }]) assert.throws(() => guard({ ...env, ...patch }, run));
  for (const patch of [{ head_sha: 'b'.repeat(40) }, { event: 'push' }, { run_attempt: 2 },
    { head_branch: 'main' }, { path: 'other.yaml' }]) assert.throws(() => guard(env, { ...run, ...patch }));
});
test('credential proof emits booleans only, distinguishing secret from placeholder/override', () => {
  const proof = credentialSummary(env, token, '/fixture/.npmrc', '//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}\n', 'https://registry.npmjs.org/');
  assert.ok(Object.values(proof).every((value) => typeof value === 'boolean'));
  assert.equal(proof.effective_npm_token_equals_step_secret, true);
  assert.equal(proof.setup_node_placeholder_selected, false);
  assert.equal(proof.userconfig_has_environment_token_reference, true);
  const wrong = credentialSummary(env, 'XXXXX-XXXXX-XXXXX-XXXXX', '/wrong', 'raw-token=hidden', 'https://foreign.invalid');
  assert.equal(wrong.effective_npm_token_equals_step_secret, false);
  assert.equal(wrong.setup_node_placeholder_selected, true);
  assert.ok(!JSON.stringify(proof).includes(token));
});
test('token metadata is projected onto fixed booleans without token,key,CIDR or other payloads', () => {
  const result = tokenSummary({ objects: [{ token: token.slice(0, 13) + '...' + token.slice(-4), key: 'SECRET_KEY_CANARY', readonly: false,
    bypass_2fa: true, cidr_whitelist: ['192.0.2.0/24'], scopes: ['@mangrove-ai'], other: token }] }, token);
  assert.equal(result.readonly, false);
  assert.equal(result.bypass_2fa, true);
  assert.equal(result.has_ip_restrictions, true);
  assert.equal(result.includes_mangrove_scope, undefined);
  const printed = JSON.stringify(result);
  for (const canary of [token, token.slice(0, 13), 'SECRET_KEY_CANARY', '192.0.2.0/24']) assert.ok(!printed.includes(canary));
});
test('absent, ambiguous or paginated legacy metadata cannot assert current granular rights', () => {
  for (const payload of [null, {}, { objects: [] }, { objects: [{ token: 'foreign' }] },
    { objects: [{ token: token.slice(0, 12) + '...' + token.slice(-4) }, { token: token.slice(0, 13) + '...' + token.slice(-4) }] },
    { objects: [{ token: token.slice(0, 13) + '...' + token.slice(-4), bypass_2fa: true }], urls: { next: 'https://private.invalid' } }]) {
    const result = tokenSummary(payload, token);
    assert.equal(result.unique_matching_redacted_token_metadata, false);
    assert.equal(result.bypass_2fa, undefined);
  }
});
test('package diagnostics emit only the two relevant identities and allowlisted rights', () => {
  assert.deepEqual(packageSummary({ '@mangrove-ai/sdk': 'read-write', '@private/secret': token,
    '@mangrove-ai/markets': token }), { '@mangrove-ai/markets': 'not_returned', '@mangrove-ai/sdk': 'read-write' });
});
test('registry adapter allows only finite GET metadata endpoints, never upload/mutation paths', async () => {
  const calls = [];
  const read = readOnlyRegistry(token, async (url, options) => { calls.push({ url, options }); return { status: 403 }; });
  for (const path of ['/-/whoami', '/-/org/mangrove-ai/user', '/-/org/mangrove-ai/package', '/-/user/owner/package', '/-/npm/v1/tokens']) {
    assert.deepEqual(await read(path), { status: 403 });
  }
  assert.ok(calls.every(({ options }) => options.method === 'GET' && options.redirect === 'error' && options.signal instanceof AbortSignal));
  const count = calls.length;
  for (const path of ['/@mangrove-ai%2fmarkets', '/-/npm/v1/tokens/token/id', '/-/npm/v1/user', 'https://foreign.invalid', '/-/user/a/../package']) {
    await assert.rejects(read(path));
  }
  assert.equal(calls.length, count);
});
test('metadata size and transport errors stop without raw auth/error output', async () => {
  const huge = readOnlyRegistry(token, async () => ({ status: 200, body: new ReadableStream({ start(controller) { controller.enqueue(Buffer.alloc(2 * 1024 * 1024 + 1)); controller.close(); } }) }));
  await assert.rejects(huge('/-/whoami'));
  assert.throws(() => readOnlyRegistry(''));
});

test('redacted matching requires both strong prefix and suffix; prefix-only and collisions are inconclusive', () => {
  for (const representation of [token.slice(0, 13), 'npm_...2345', token.slice(0, 13) + '...bad!',
    token.slice(0, 13) + '...123', 'foreign_prefix...' + token.slice(-4)]) {
    assert.equal(tokenSummary({ objects: [{ token: representation, bypass_2fa: true }] }, token).unique_matching_redacted_token_metadata, false);
  }
  const representation = token.slice(0, 13) + '...' + token.slice(-4);
  const collision = tokenSummary({ objects: [{ token: representation }, { token: representation }] }, token);
  assert.equal(collision.matching_current_token_records, 2);
  assert.equal(collision.unique_matching_redacted_token_metadata, false);
  const result = tokenSummary({ objects: [{ token: representation, bypass_2fa: false }] }, token);
  assert.equal(result.unique_matching_redacted_token_metadata, true);
  assert.equal(result.bypass_2fa, false);
  assert.ok(!JSON.stringify(result).includes(representation));
});
test('stream cancellation bounds registry metadata before unbounded allocation', async () => {
  let cancelled = false;
  const read = readOnlyRegistry(token, async () => ({ status: 200, body: new ReadableStream({
    pull(controller) { controller.enqueue(Buffer.alloc(1024 * 1024)); },
    cancel() { cancelled = true; },
  }) }));
  await assert.rejects(read('/-/npm/v1/tokens'));
  assert.equal(cancelled, true);
});

test('lifecycle endpoint accepts only the exact Markets version and fixed status enums', () => {
  for (const status of ['published', 'validating', 'staged', 'blocked', 'deleted']) {
    const result = lifecycleSummary({ packageName: '@mangrove-ai/markets', version: '0.4.0', status, secret: token });
    assert.deepEqual(result, { package: '@mangrove-ai/markets', version: '0.4.0', status });
    assert.ok(!JSON.stringify(result).includes(token));
  }
  for (const patch of [{ packageName: '@mangrove-ai/sdk' }, { version: '1.0.0' }, { status: token }]) {
    assert.throws(() => lifecycleSummary({ packageName: '@mangrove-ai/markets', version: '0.4.0', status: 'published', ...patch }));
  }
});
test('only the single exact lifecycle GET is added; neighboring versions and mutation paths stay denied', async () => {
  const requests = [];
  const read = readOnlyRegistry(token, async (url, options) => { requests.push({ url, options }); return { status: 403 }; });
  assert.deepEqual(await read(STATUS_PATH), { status: 403 });
  assert.equal(requests[0].options.method, 'GET');
  for (const path of [STATUS_PATH.replace('0.4.0', '0.5.0'), STATUS_PATH.replace('markets', 'sdk'),
    STATUS_PATH.replace('/status', '/approve'), '/-/stage/package/@mangrove-ai%2fmarkets']) await assert.rejects(read(path));
  assert.equal(requests.length, 1);
});
