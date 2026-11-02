import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const REPO = 'MangroveTechnologies/MangroveMarkets';
const BRANCH = 'codex/markets-npm-auth-diagnostics';
const REGISTRY = 'https://registry.npmjs.org';
export const STATUS_PATH = '/-/package/@mangrove-ai%2fmarkets/version/0.4.0/status';
const fail = () => { throw new Error('Read-only npm diagnosis stopped safely.'); };
export function guard(env, run) {
  if (env.GITHUB_REPOSITORY !== REPO || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
      env.GITHUB_REF !== `refs/heads/${BRANCH}` ||
      env.GITHUB_WORKFLOW_REF !== `${REPO}/.github/workflows/publish.yaml@refs/heads/${BRANCH}` ||
      !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '') || !/^\d+$/.test(env.GITHUB_RUN_ID ?? '') ||
      String(run?.id) !== env.GITHUB_RUN_ID || run.head_sha !== env.GITHUB_SHA ||
      run.head_branch !== BRANCH || run.event !== 'workflow_dispatch' ||
      run.path !== '.github/workflows/publish.yaml' || run.repository?.full_name !== REPO ||
      String(run.run_attempt) !== env.GITHUB_RUN_ATTEMPT || run.status !== 'in_progress') fail();
}
export function credentialSummary(env, effective, userconfig, text, registry) {
  return {
    token_present: typeof env.NODE_AUTH_TOKEN === 'string' && env.NODE_AUTH_TOKEN.length > 0,
    effective_npm_token_equals_step_secret: !!effective && effective === env.NODE_AUTH_TOKEN,
    setup_node_placeholder_selected: effective === 'XXXXX-XXXXX-XXXXX-XXXXX',
    effective_userconfig_is_setup_node_file: userconfig === resolve(env.RUNNER_TEMP, '.npmrc'),
    userconfig_has_environment_token_reference: text.split(/\r?\n/).includes('//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}'),
    effective_registry_is_npm: [REGISTRY, `${REGISTRY}/`].includes(registry),
  };
}
export function tokenSummary(payload, token) {
  const objects = Array.isArray(payload?.objects) ? payload.objects : [];
  const matches = objects.filter((x) => {
    if (typeof x?.token !== 'string') return false;
    const parts = x.token.split(/\.\.\.|\u2026/);
    return parts.length === 2 && parts[0].length >= 8 && parts[1].length >= 4 &&
      token.length > parts[0].length + parts[1].length && token.startsWith(parts[0]) && token.endsWith(parts[1]);
  });
  const result = { matching_current_token_records: matches.length, response_has_more_records: !!payload?.urls?.next, unique_matching_redacted_token_metadata: matches.length === 1 && !payload?.urls?.next };
  if (matches.length !== 1 || payload?.urls?.next) return result;
  const selected = matches[0];
  for (const key of ['readonly', 'automation', 'bypass_2fa', 'bypass2fa', 'bypass2FA']) {
    if (typeof selected[key] === 'boolean') result[key] = selected[key];
  }
  if (Array.isArray(selected.cidr_whitelist)) result.has_ip_restrictions = selected.cidr_whitelist.length > 0;
  result.granular_scope_metadata_exposed = Array.isArray(selected.scopes);
  return result;
}
export function packageSummary(body) {
  const result = {};
  for (const name of ['@mangrove-ai/markets', '@mangrove-ai/sdk']) {
    const value = body?.[name];
    result[name] = ['read-write', 'read-only', 'write', 'read'].includes(value) ? value : 'not_returned';
  }
  return result;
}
export function lifecycleSummary(body) {
  if (body?.packageName !== '@mangrove-ai/markets' || body.version !== '0.4.0' ||
      !['published', 'validating', 'staged', 'blocked', 'deleted'].includes(body.status)) fail();
  return { package: body.packageName, version: body.version, status: body.status };
}
export function readOnlyRegistry(token, fetchApi = globalThis.fetch) {
  if (!token) fail();
  return async (path) => {
    if (path !== STATUS_PATH && !/^\/-\/(whoami|org\/mangrove-ai\/(user|package)|user\/[a-z0-9][a-z0-9._-]{0,213}\/package|npm\/v1\/tokens)$/.test(path)) fail();
    const response = await fetchApi(REGISTRY + path, { method: 'GET', redirect: 'error',
      signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
    if (response.status !== 200) return { status: response.status };
    if (!response.body) fail();
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2 * 1024 * 1024) fail();
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    return { status: 200, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
  };
}
async function main() {
  const env = process.env;
  const runResponse = await fetch(`https://api.github.com/repos/${REPO}/actions/runs/${env.GITHUB_RUN_ID}`, {
    redirect: 'error', signal: AbortSignal.timeout(15000), headers: {
      Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.GH_TOKEN}`, 'X-GitHub-Api-Version': '2026-03-10',
    },
  });
  if (runResponse.status !== 200) fail();
  guard(env, await runResponse.json());
  const npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const requireNpm = createRequire(resolve(npmRoot, 'npm/package.json'));
  const Config = requireNpm('@npmcli/config');
  const { definitions, flatten, shorthands } = requireNpm('@npmcli/config/lib/definitions');
  const config = new Config({ npmPath: resolve(npmRoot, 'npm'), definitions, flatten, shorthands,
    argv: ['node', 'npm', 'publish', '--registry=https://registry.npmjs.org', '--tag=latest'], cwd: resolve('packages/sdk') });
  await config.load();
  const credentials = config.getCredentialsByURI(`${REGISTRY}/`);
  const summary = credentialSummary(env, credentials.token, config.get('userconfig'),
    readFileSync(config.get('userconfig'), 'utf8'), config.get('registry'));
  const npm = readOnlyRegistry(credentials.token);
  const identity = await npm('/-/whoami');
  const username = identity.body?.username;
  if (identity.status !== 200 || typeof username !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,213}$/.test(username)) fail();
  const report = { source: env.GITHUB_SHA, run: env.GITHUB_RUN_ID, operation: 'read-only-no-upload',
    npm_version: requireNpm('./package.json').version, credential_plumbing: summary, npm_username: username };
  const roster = await npm('/-/org/mangrove-ai/user');
  report.organization_membership = { status: roster.status,
    current_user_role: ['owner', 'admin', 'developer'].includes(roster.body?.[username]) ? roster.body[username] : 'not_returned' };
  const orgPackages = await npm('/-/org/mangrove-ai/package');
  report.organization_package_access = { status: orgPackages.status, packages: packageSummary(orgPackages.body) };
  const userPackages = await npm(`/-/user/${username}/package`);
  report.user_package_access = { status: userPackages.status, packages: packageSummary(userPackages.body) };
  const tokens = await npm('/-/npm/v1/tokens');
  report.current_token_metadata = { status: tokens.status, ...tokenSummary(tokens.body, credentials.token),
    note: 'Only uniquely matching redacted metadata is reported. Incomplete metadata/redaction never proves complete granular bypass/scope rights.' };
  const lifecycle = await npm(STATUS_PATH);
  report.package_version_lifecycle = { http_status: lifecycle.status,
    ...(lifecycle.status === 200 ? lifecycleSummary(lifecycle.body) : {}) };
  console.log(JSON.stringify(report));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Read-only npm diagnosis failed; no raw credential/config/error output emitted.'); process.exitCode = 1; });
}
