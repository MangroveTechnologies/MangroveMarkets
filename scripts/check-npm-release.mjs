import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PACKAGE_NAME = '@mangrove-ai/sdk';

/** Only a genuine 404 means an unpublished version. Registry/auth outages stop release. */
export async function versionExists(metadata, fetchVersion = globalThis.fetch) {
  if (metadata?.name !== PACKAGE_NAME ||
      typeof metadata.version !== 'string' ||
      !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(metadata.version)) {
    throw new Error('Unexpected Markets package identity or version.');
  }
  const url = `https://registry.npmjs.org/${encodeURIComponent(PACKAGE_NAME)}/${encodeURIComponent(metadata.version)}`;
  const response = await fetchVersion(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (response.status === 404) return false;
  if (response.status !== 200) throw new Error('npm registry did not return 200 or 404.');
  const published = await response.json();
  if (published?.name !== PACKAGE_NAME || published.version !== metadata.version) {
    throw new Error('npm registry returned unexpected package identity or version.');
  }
  return true;
}

async function main() {
  const metadata = JSON.parse(readFileSync(new URL('../packages/sdk/package.json', import.meta.url), 'utf8'));
  const exists = await versionExists(metadata);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${metadata.version}\nexists=${exists}\n`);
  }
  console.log(exists ? 'Markets version already published; skip release.' : 'Markets version absent; publication prerequisites still required.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error('npm registry preflight failed; publication stopped.');
    process.exitCode = 1;
  });
}
