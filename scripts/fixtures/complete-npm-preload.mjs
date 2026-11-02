// Offline fixture for the real completion CLI. Unexpected commands/requests fail closed.
import childProcess from 'node:child_process';
import module from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const fixture = JSON.parse(readFileSync(process.env.MARKETS_RELEASE_FIXTURE, 'utf8'));
const observed = { requests: [], commands: [], writes: 0, clock: 0 };
process.on('exit', () => writeFileSync(fixture.observed, JSON.stringify(observed)));
childProcess.execFileSync = (command, args) => {
  observed.commands.push([command, ...args]);
  if (command === 'git' && args.join(' ') === 'rev-parse HEAD') return fixture.source;
  if (command === 'git' && args.join(' ') === 'status --porcelain --untracked-files=no') return '';
  if (command === 'npm' && args.join(' ') === 'root -g') return '/offline/npm';
  throw new Error('Unexpected child process; all publication commands are forbidden');
};
module.createRequire = () => (name) => {
  if (name !== '@npmcli/package-json') throw new Error('Unexpected require');
  return { fix: async () => ({ prepare: async () => ({ content: fixture.published }) }) };
};
module.syncBuiltinESMExports();
Object.defineProperty(performance, 'now', { value: () => observed.clock });
globalThis.setTimeout = (callback, delay) => {
  observed.clock += delay;
  queueMicrotask(callback);
};
const { source, published, archive, tagSha, scenario } = fixture;
const bytes = Buffer.from(archive, 'base64');
let metadataReads = 0, archiveReads = 0;
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
globalThis.fetch = async (address, options = {}) => {
  const url = String(address), method = options.method ?? 'GET';
  observed.requests.push({ url, method });
  if (method !== 'GET') { observed.writes++; throw new Error('Unexpected external write'); }
  if (url.startsWith('https://registry.npmjs.org/')) {
    if (url === published.dist.tarball) {
      archiveReads++;
      if (scenario === 'delayed' && archiveReads === 1) return response({}, 404);
      return new Response(scenario === 'corrupt' ? Buffer.from('corrupt') : bytes);
    }
    metadataReads++;
    if (scenario === 'timeout' || (scenario === 'delayed' && metadataReads <= 5)) return response({}, 404);
    if (scenario === 'auth') return response({}, 401);
    if (scenario === 'rate') return response({}, 429);
    if (scenario === 'network') throw new Error('Offline simulated network failure');
    return response(scenario === 'source-conflict' ? { ...published, gitHead: 'f'.repeat(40) } : published);
  }
  const root = 'https://api.github.com/repos/MangroveTechnologies/MangroveMarkets';
  if (!url.startsWith(root)) throw new Error('Unexpected host; networking is forbidden');
  const path = url.slice(root.length), tag = `typescript-sdk-v${published.version}`;
  if (path === '/commits/main') return response({ sha: source });
  if (path === '/actions/runs/123') return response({ id: 123, run_attempt: 1,
    repository: { full_name: 'MangroveTechnologies/MangroveMarkets' }, event: 'workflow_dispatch',
    path: '.github/workflows/publish.yaml', head_branch: 'main', head_sha: source, status: 'in_progress' });
  if (path === `/git/ref/tags/${tag}`) return response({ ref: `refs/tags/${tag}`, object: { sha: tagSha, type: 'tag' } });
  if (path === `/git/tags/${tagSha}`) return response({ sha: tagSha, tag,
    message: `MangroveMarkets TypeScript SDK ${published.version}\nSource: ${source}\n`,
    object: { type: 'commit', sha: scenario === 'tag-conflict' ? 'f'.repeat(40) : source } });
  if (path === `/releases/tags/${tag}`) {
    const sri = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    const sha = createHash('sha256').update(bytes).digest('hex');
    return response({ tag_name: tag, name: `MangroveMarkets TypeScript SDK ${published.version}`,
      body: `MangroveMarkets TypeScript SDK ${published.version}\n\nPackage: ${published.name}\nSource: ${source}\n` +
        `npm archive: ${published.dist.tarball}\nIntegrity: ${sri}\nSHA256: ${sha}\n\n` +
        'This is the Markets SDK. MangroveAI uses the separate @mangrove-ai/sdk 1.x package.\n' +
        'Package publication does not establish funded venue acceptance or service deployment.',
      draft: false, prerelease: false,
      html_url: `https://github.com/MangroveTechnologies/MangroveMarkets/releases/tag/${tag}` });
  }
  throw new Error('Unexpected GitHub request');
};
