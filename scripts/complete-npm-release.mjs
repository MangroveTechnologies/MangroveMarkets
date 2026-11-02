import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { PACKAGE_NAME } from './check-npm-release.mjs';

export const REPOSITORY = 'MangroveTechnologies/MangroveMarkets';
export const REPOSITORY_URL = `https://github.com/${REPOSITORY}`;
const WORKFLOW = '.github/workflows/publish.yaml';
const MAX_ARCHIVE = 20 * 1024 * 1024;
const fail = () => { throw new Error('Markets release identity or artifact verification failed.'); };
export function releaseVersion(version) {
  if (typeof version !== 'string' || version.length > 40 || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) return false;
  const [major, minor] = version.split('.').map(Number);
  return major > 0 || minor >= 4;
}
export const integrity = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;

export function validateContext(env, head, gitDirectory, clean, run, main, metadata, resume = false, comparison = null) {
  if (metadata?.name !== PACKAGE_NAME || !releaseVersion(metadata.version) ||
      metadata.repository?.url !== REPOSITORY_URL || metadata.repository?.directory !== 'packages/sdk' ||
      env.GITHUB_REPOSITORY !== REPOSITORY || !['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME) ||
      env.GITHUB_REF !== 'refs/heads/main' ||
      env.GITHUB_WORKFLOW_REF !== `${REPOSITORY}/${WORKFLOW}@refs/heads/main` ||
      !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '') || head !== env.GITHUB_SHA || !gitDirectory || !clean ||
      !/^\d+$/.test(env.GITHUB_RUN_ID ?? '') || !/^\d+$/.test(env.GITHUB_RUN_ATTEMPT ?? '') ||
      String(run?.id) !== env.GITHUB_RUN_ID || String(run.run_attempt) !== env.GITHUB_RUN_ATTEMPT ||
      run.repository?.full_name !== REPOSITORY || run.event !== env.GITHUB_EVENT_NAME || run.path !== WORKFLOW ||
      run.head_branch !== 'main' || run.head_sha !== head || run.status !== 'in_progress' ||
      !/^[a-f0-9]{40}$/.test(main?.sha ?? '') ||
      (main.sha !== head && (!resume || comparison?.status !== 'ahead' ||
        comparison.base_commit?.sha !== head || comparison.merge_base_commit?.sha !== head))) fail();
  return { source: head, version: metadata.version, tag: `typescript-sdk-v${metadata.version}` };
}

export function packEvidence(pack, bytes, filename, expectedVersion) {
  if (!Array.isArray(pack) || pack.length !== 1 || pack[0]?.name !== PACKAGE_NAME ||
      pack[0].version !== expectedVersion || pack[0].filename !== filename ||
      filename !== `mangrove-ai-markets-${expectedVersion}.tgz` || bytes.length > MAX_ARCHIVE ||
      pack[0].size !== bytes.length || pack[0].integrity !== integrity(bytes)) fail();
  return { integrity: integrity(bytes), sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length };
}

export async function download(response) {
  if (response.status !== 200 || !response.body) fail();
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > MAX_ARCHIVE) fail();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function verifyPublished(metadata, source, evidence, fetchVersion = globalThis.fetch,
  { acceptedUpload = false, now = () => performance.now(), wait = (ms) => new Promise((done) => setTimeout(done, ms)) } = {}) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(PACKAGE_NAME)}/${metadata.version}`;
  // An accepted npm upload can remain invisible while registry processing finishes.
  // Only this read-after-write 404 is retryable; preflight and all other errors stop.
  const deadline = now() + 10 * 60 * 1000;
  const readVisible = async (address, timeout) => {
    for (;;) {
      const remaining = acceptedUpload ? deadline - now() : timeout;
      if (remaining <= 0) fail();
      const response = await fetchVersion(address, { method: 'GET', redirect: 'error',
        signal: AbortSignal.timeout(Math.max(1, Math.ceil(Math.min(timeout, remaining)))) });
      if (response.status === 200) return response;
      if (response.status !== 404 || !acceptedUpload || now() >= deadline) fail();
      if (typeof response.body?.cancel === 'function') await response.body.cancel();
      await wait(Math.min(30000, deadline - now()));
    }
  };
  const published = await (await readVisible(url, 15000)).json();
  const tarball = `https://registry.npmjs.org/@mangrove-ai/markets/-/markets-${metadata.version}.tgz`;
  if (published?.name !== PACKAGE_NAME || published.version !== metadata.version ||
      published.gitHead !== source || published.repository?.url !== `git+${REPOSITORY_URL}.git` ||
      published.repository?.directory !== 'packages/sdk' || published.dist?.integrity !== evidence.integrity ||
      published.dist?.tarball !== tarball) fail();
  const bytes = await download(await readVisible(tarball, 30000));
  if (integrity(bytes) !== evidence.integrity || createHash('sha256').update(bytes).digest('hex') !== evidence.sha256) fail();
  return { package: PACKAGE_NAME, version: metadata.version, source, tarball, ...evidence };
}

export function releaseBody(verified) {
  return `MangroveMarkets TypeScript SDK ${verified.version}\n\n` +
    `Package: ${verified.package}\nSource: ${verified.source}\n` +
    `npm archive: ${verified.tarball}\nIntegrity: ${verified.integrity}\nSHA256: ${verified.sha256}\n\n` +
    'This is the Markets SDK. MangroveAI uses the separate @mangrove-ai/sdk 1.x package.\n' +
    'Package publication does not establish funded venue acceptance or service deployment.';
}

/** Reuse exact matching releases only. An ambiguous write is never retried here. */
export async function completeGithubRelease(context, verified, github) {
  const tagPath = `/git/ref/tags/${context.tag}`;
  let ref = await github('GET', tagPath, undefined, [200, 404]);
  if (ref.status === 404) {
    const object = await github('POST', '/git/tags', {
      tag: context.tag, message: `MangroveMarkets TypeScript SDK ${context.version}\nSource: ${context.source}\n`,
      object: context.source, type: 'commit',
    });
    if (!/^[a-f0-9]{40}$/.test(object.data?.sha ?? '')) fail();
    await github('POST', '/git/refs', { ref: `refs/tags/${context.tag}`, sha: object.data.sha });
    ref = await github('GET', tagPath);
  }
  if (ref.data?.ref !== `refs/tags/${context.tag}` || ref.data.object?.type !== 'tag' ||
      !/^[a-f0-9]{40}$/.test(ref.data.object.sha ?? '')) fail();
  const tag = (await github('GET', `/git/tags/${ref.data.object.sha}`)).data;
  if (tag?.sha !== ref.data.object.sha || tag.tag !== context.tag || tag.object?.type !== 'commit' || tag.object.sha !== context.source ||
      tag.message !== `MangroveMarkets TypeScript SDK ${context.version}\nSource: ${context.source}\n`) fail();
  const expected = { tag_name: context.tag, name: `MangroveMarkets TypeScript SDK ${context.version}`,
    body: releaseBody(verified), draft: false, prerelease: false };
  const path = `/releases/tags/${context.tag}`;
  let release = await github('GET', path, undefined, [200, 404]);
  if (release.status === 404) {
    await github('POST', '/releases', { ...expected, target_commitish: context.source, make_latest: 'false' });
    release = await github('GET', path);
  }
  if (Object.entries(expected).some(([key, value]) => release.data?.[key] !== value) ||
      release.data.html_url !== `${REPOSITORY_URL}/releases/tag/${context.tag}`) fail();
  return { ...verified, tag: context.tag, release: release.data.html_url };
}

export function githubClient(token, fetchApi = globalThis.fetch) {
  if (!token) fail();
  return async (method, path, body, statuses = [200, 201]) => {
    const response = await fetchApi(`https://api.github.com/repos/${REPOSITORY}${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2026-03-10', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!statuses.includes(response.status)) fail();
    return { status: response.status, data: response.status === 404 ? null : await response.json() };
  };
}

export function verifyPreparedManifest(prepared, source, version) {
  if (prepared?.name !== PACKAGE_NAME || prepared.version !== version || !releaseVersion(version) || prepared.gitHead !== source ||
      prepared.repository?.url !== `git+${REPOSITORY_URL}.git` || prepared.repository?.directory !== 'packages/sdk') fail();
}

async function main() {
  const mode = process.argv[2];
  if (!['preflight', 'complete'].includes(mode)) fail();
  const metadata = JSON.parse(readFileSync(new URL('../packages/sdk/package.json', import.meta.url), 'utf8'));
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const github = githubClient(process.env.GH_TOKEN);
  const env = process.env;
  const head = git('rev-parse', 'HEAD');
  // Resume is read-only until the existing npm archive is proven identical below.
  const resume = mode === 'complete' || (mode === 'preflight' && process.argv[3] === 'true');
  const main = (await github('GET', '/commits/main')).data;
  const comparison = resume && main?.sha !== head
    ? (await github('GET', `/compare/${head}...${main.sha}`)).data : null;
  const context = validateContext(env, head, statSync('.git').isDirectory(),
    git('status', '--porcelain', '--untracked-files=no') === '',
    (await github('GET', `/actions/runs/${env.GITHUB_RUN_ID}`)).data, main, metadata, resume, comparison);
  // Use the same bundled npm prepare implementation used by directory publish.
  // This does not save a manifest or add a fabricated gitHead field.
  const npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const npmRequire = createRequire(resolve(npmRoot, 'npm/package.json'));
  const PackageJson = npmRequire('@npmcli/package-json');
  verifyPreparedManifest((await (await PackageJson.fix(resolve('packages/sdk'))).prepare()).content, head, metadata.version);
  if (mode === 'preflight') { console.log('Native main source and actual npm-prepared Markets manifest verified.'); return; }
  const pack = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  const filename = `mangrove-ai-markets-${metadata.version}.tgz`;
  const bytes = readFileSync(resolve(process.env.RUNNER_TEMP, filename));
  const evidence = packEvidence(pack, bytes, basename(filename), metadata.version);
  const verified = await verifyPublished(metadata, context.source, evidence, globalThis.fetch,
    { acceptedUpload: process.argv[4] === 'true' });
  // Repeat exact current-main ancestry immediately before any version-object write.
  const finalMain = (await github('GET', '/commits/main')).data;
  const finalCompare = finalMain?.sha === head ? null
    : (await github('GET', `/compare/${head}...${finalMain?.sha}`)).data;
  validateContext(env, head, true, true,
    (await github('GET', `/actions/runs/${env.GITHUB_RUN_ID}`)).data, finalMain, metadata, true, finalCompare);
  console.log(JSON.stringify(await completeGithubRelease(context, verified, github)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Markets release completion failed closed; inspect the exact native source run before retrying.'); process.exitCode = 1; });
}
