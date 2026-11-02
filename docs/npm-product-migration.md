# npm product migration and ordered release

## Choose the product explicitly

| Package and version | Product | Migration target |
| --- | --- | --- |
| Published `@mangrove-ai/sdk` 0.1.2, 0.2.0 and 0.3.0 | Legacy MangroveMarkets | `@mangrove-ai/markets` 0.4.0 |
| Published `@mangrove-ai/markets` 0.4.0 | MangroveMarkets DEX, wallet and venue workflows | Keep this package for Markets |
| Published `@mangrove-ai/sdk` 1.1.0 | MangroveAI strategy, backtesting and execution APIs | Separate AI API; not a compatible Markets upgrade |
| Unpublished `@mangrove-ai/client` 0.1.0 source | MangroveAI | Renamed to `@mangrove-ai/sdk` 1.0.0; no alias package is published |

Registry checkpoint: November 2, 2026. Markets `@mangrove-ai/markets` 0.4.0
and AI `@mangrove-ai/sdk` 1.1.0 are published, with distinct APIs. The exact
historical Markets versions under `@mangrove-ai/sdk` retain their migration
notices. `@mangrove-ai/client` remains an unpublished candidate, not an alias.
This branch prepares Markets npm 0.4.1 and Python 1.1.2; these patch candidates
include the complete MIT license without changing runtime APIs. No existing
archive or tag is overwritten.

## Move a Markets application

Replace the dependency key and import path together. After the new-name release
is verified, install the Markets package:

```bash
npm install @mangrove-ai/markets@0.4.0
```

```typescript
import { MangroveClient, EthersSigner } from '@mangrove-ai/markets';
```

Remove the legacy `@mangrove-ai/sdk` dependency if the application does not also
use MangroveAI. Public Markets class/type exports are unchanged. Private Claude
and OpenClaw workspace consumers move their dependency and import to the new
Markets name; their own package identities remain private and unchanged.

Do not change an old Markets dependency to `@mangrove-ai/sdk@1.0.0` and expect
the same API. If both products are needed, install each explicitly and use its
own client, credentials and API base. Python package names remain
`mangrovemarkets` and `mangroveai`.

The 0.4.0 Markets implementation also contains changes beyond the old public
0.3.0 artifact: complete tool results, the Kraken OAuth client and local unfunded
wallet creation. Local key material must stay in caller custody; creation does
not fund a wallet. Marketplace listings, offers and escrow remain under
construction. See the [capability matrix](markets-sdk-capability-matrix.md).

## Current patch publication and recovery order

The initial product migration is historical: [Markets PR67](https://github.com/MangroveTechnologies/MangroveMarkets/pull/67) published the new
Markets identity at 0.4.0, followed by AI 1.x under `@mangrove-ai/sdk`. That
completed first-release sequence is not repeated for each patch.

1. Review [PR69](https://github.com/MangroveTechnologies/MangroveMarkets/pull/69)
   and require its actual current-head CI, real built archive license checks and
   offline release-CLI checks. Source builds alone do not prove publication.
2. Human merge of [PR69](https://github.com/MangroveTechnologies/MangroveMarkets/pull/69) changes `packages/sdk/package.json` to 0.4.1 and therefore
   automatically starts the existing [Publish SDK workflow](../.github/workflows/publish.yaml)
   on main. This is a package release, not a docs-only merge. Native release
   events remain inert; no feature-branch publication is accepted.
3. Bind the native run to the actual merged main SHA and prepared npm manifest
   `gitHead`. An absent version requires current main before upload. Authentication,
   rate/network errors and conflicting metadata stop publication. The qualified
   directory is published with lifecycle scripts disabled, after lint, tests,
   build, exact packing and full-license verification.
4. Verify npm 0.4.1's downloaded archive against SHA512 integrity and SHA256,
   source `gitHead`, repository and package identity. Only after a just-accepted
   upload may metadata/archive HTTP404 processing delays wait: GET-only every
   30 seconds under one shared ten-minute deadline. Other failures stop, with no
   upload retry. Ordinary preflight and existing-artifact recovery do not wait.
5. Create or verify the exact annotated `typescript-sdk-v0.4.1` tag and GitHub
   Release. Matching existing objects are reused; conflicting objects are never
   overwritten. Repeated complete matching runs perform no publication writes.
6. Publish prepared Python 1.1.2 separately through the existing main-only
   `python-sdk-release.yml` manual workflow with `bump=patch`. Its source version
   must match the computed next version, and wheel/sdist license checks run
   before its exact-source tag and PyPI upload.

A failed run does not establish publication. Reconcile actual registry objects,
source and bytes first. If a new version was never uploaded and main advanced,
use a fresh native dispatch from current main after its checks pass:

```bash
gh workflow run publish.yaml --repo MangroveTechnologies/MangroveMarkets --ref main
```

The native publisher takes package/version from committed source, not arbitrary
inputs. If an upload already succeeded, an intact original native source run may
complete its exact tag/release after main advances only when its original source
is still an ancestor and npm `gitHead`, repository, integrity and downloaded bytes
all match. Do not allocate another version to hide a partial release or blindly
repeat an ambiguous write. The already published 0.4.0 artifact does not need to
be uploaded again to ship this repair.

Package publication does not deploy the server, verify a venue or establish
funded acceptance. Cloud/domain/venue migration and frontend publication remain held. Terraform
adoption is a separate unfinished workstream.

## Historical first-release deprecation plan

The first AI release owned the three exact historical-version notices after
Markets 0.4.0 was verified. That migration is complete. This Markets workflow
never deprecates packages, and [PR69](https://github.com/MangroveTechnologies/MangroveMarkets/pull/69) requires no new deprecation. The historical
command text below is retained as a record, not a current execution plan. The
[AI release controller](https://github.com/MangroveTechnologies/MangroveAI-SDK/blob/main/scripts/complete_typescript_release.mjs)
is authoritative for the current exact notice and skips already matching notices.
The existing old archives and notice scope remain unchanged; AI 1.x must never
receive a Markets migration notice.

```bash
npm deprecate '@mangrove-ai/sdk@0.1.2' 'Legacy MangroveMarkets SDK. Use @mangrove-ai/markets@0.4.0 for Markets; @mangrove-ai/sdk@1.x is the separate MangroveAI product.'
```

```bash
npm deprecate '@mangrove-ai/sdk@0.2.0' 'Legacy MangroveMarkets SDK. Use @mangrove-ai/markets@0.4.0 for Markets; @mangrove-ai/sdk@1.x is the separate MangroveAI product.'
```

```bash
npm deprecate '@mangrove-ai/sdk@0.3.0' 'Legacy MangroveMarkets SDK. Use @mangrove-ai/markets@0.4.0 for Markets; @mangrove-ai/sdk@1.x is the separate MangroveAI product.'
```

For an authorized future notice change, read each exact old version's `deprecated`
field and confirm AI 1.x has no such field. Do not substitute a package-wide command,
a wildcard range or a default-tag check for those version-specific checks.

Cloud/domain/venue migration and frontend publication remain held. Service
deployment and funded live acceptance remain separate. Preparing this source PR performs no publication, tag, deprecation, deployment
or cloud permission change. Human merge starts the normal native publisher as
described above.
