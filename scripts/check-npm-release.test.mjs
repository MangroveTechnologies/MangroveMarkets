import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACKAGE_NAME, versionExists } from './check-npm-release.mjs';

const metadata = { name: PACKAGE_NAME, version: '0.4.0' };
const reply = (status, body = metadata) => async () => ({ status, json: async () => body });

test('200 requires the exact published package and version', async () => {
  let request;
  assert.equal(await versionExists(metadata, async (url, options) => {
    request = { url, options };
    return { status: 200, json: async () => metadata };
  }), true);
  assert.equal(request.url, 'https://registry.npmjs.org/%40mangrove-ai%2Fsdk/0.4.0');
  assert.equal(request.options.redirect, 'error');
  assert.ok(request.options.signal instanceof AbortSignal);
});

test('404 alone means absent, without trusting the error body', async () => {
  assert.equal(await versionExists(metadata, async () => ({
    status: 404, json: async () => { throw new Error('Error bodies are not package metadata'); },
  })), false);
});

for (const status of [401, 403, 429, 500, 502, 503]) {
  test(`HTTP ${status} stops publication rather than reporting absence`, async () => {
    await assert.rejects(versionExists(metadata, reply(status)));
  });
}

test('network errors and redirects stop publication', async () => {
  await assert.rejects(versionExists(metadata, async () => { throw new TypeError('network unavailable'); }));
  await assert.rejects(versionExists(metadata, reply(302)));
});

for (const body of [null, [], {}, { name: '@mangrove-ai/client', version: '0.4.0' },
  { name: PACKAGE_NAME, version: '0.3.0' }]) {
  test(`200 with invalid identity ${JSON.stringify(body)} stops publication`, async () => {
    await assert.rejects(versionExists(metadata, reply(200, body)));
  });
}

test('malformed registry JSON stops publication', async () => {
  await assert.rejects(versionExists(metadata, async () => ({
    status: 200, json: async () => { throw new SyntaxError('invalid JSON'); },
  })));
});

test('a foreign package or output-injection version is rejected before any request', async () => {
  let requests = 0;
  const fetchVersion = async () => { requests++; return { status: 404 }; };
  await assert.rejects(versionExists({ name: '@mangrove-ai/client', version: '0.4.0' }, fetchVersion));
  await assert.rejects(versionExists({ name: PACKAGE_NAME, version: '0.4.0\nexists=false' }, fetchVersion));
  assert.equal(requests, 0);
});
