# npm product migration and ordered release

## Choose the product explicitly

| Package and version | Product | Migration target |
| --- | --- | --- |
| Published `@mangrove-ai/sdk` 0.1.2, 0.2.0 and 0.3.0 | Legacy MangroveMarkets | `@mangrove-ai/markets` 0.4.0 |
| New `@mangrove-ai/markets` 0.4.0 | MangroveMarkets DEX, wallet and venue workflows | Keep this package for Markets |
| New `@mangrove-ai/sdk` 1.0.0 | MangroveAI strategy, backtesting and execution APIs | Separate AI API; not a compatible Markets upgrade |
| Unpublished `@mangrove-ai/client` 0.1.0 source | MangroveAI | Renamed to `@mangrove-ai/sdk` 1.0.0; no alias package is published |

Registry checkpoint: November 1, 2026 (America/Chicago). The published old-name
versions are 0.1.2, 0.2.0 and 0.3.0. Both new product identities are source
candidates until their official workflows publish and the registry is read back.
Old artifacts remain untouched. No existing 0.x archive is rewritten or relabeled.

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

## Official publication order

1. Review the source PRs and their exact-head CI for both products. Source builds
   and local archives do not prove publication. Keep the old published archives.
2. **Human merge of Markets PR67 starts publication.** The existing
   [Publish SDK workflow](../.github/workflows/publish.yaml) triggers on a push to
   `main` that changes `packages/sdk/package.json`; this rename changes that file.
   Unlike the earlier docs-only scope, merging this PR will automatically attempt
   `@mangrove-ai/markets` 0.4.0 publication. Its release-published trigger remains declared for compatibility, but that
   event is inert. The automatic native `main` push remains the normal release
   path; a manual current-main recovery path is also available. No feature-branch
   publication or arbitrary package/version input is accepted.
3. Bind the successful run to the actual merged `main` SHA, not just the PR head.
   The workflow requires exact Markets metadata, accepts only HTTP 200 with the
   expected name/version or a genuine 404, and checks npm authentication before
   publishing a new version with provenance. It uses the actual bundled npm
   manifest preparation to require a genuine source `gitHead`, builds and packs
   the reviewed package, and publishes the directory with lifecycle scripts
   disabled so the package is not rebuilt after qualification. The repository token may still need
   new-package permission. A token's existence and `whoami` success do not prove
   package-scoped publish authority; diagnose actual failures rather than assume.
4. Read back and download `@mangrove-ai/markets` 0.4.0. Verify its exact name,
   version, integrity, provenance/producer source and installed exports/examples.
   The same run verifies the downloaded archive against the prepared Base64
   SHA512 integrity and SHA256, then creates or verifies the annotated
   `typescript-sdk-v0.4.0` tag and published GitHub release. The tag dereferences
   the exact source commit; the release records the verified npm URL and hashes.
   It does not replace the repository's Python latest-release marker.
   Only after that succeeds may the separate AI repository's reviewed official
   workflow publish `@mangrove-ai/sdk` 1.0.0 and move that name's `latest` tag.
   Never publish the abandoned `@mangrove-ai/client` name.
5. Verify the AI 1.0.0 artifact separately and prove that the two installed
   packages coexist with distinct product imports. Update consumers deliberately;
   no live funded action is implied by an installed-package check.

Read-only Markets registry verification:

```bash
npm view @mangrove-ai/markets@0.4.0 name version dist.integrity dist.tarball --json
```

A failed publish is not publication. After correcting an actual failure, retry
the failed jobs of the original official main-push or current-main manual run while its source remains
current main. If npm upload never happened and main has since advanced, run the
reviewed publisher from **current main** instead:

```bash
gh workflow run publish.yaml --repo MangroveTechnologies/MangroveMarkets --ref main
```

This native recovery operation reads the exact package/version from committed
main, verifies the actual dispatch run and current-main source, and rebuilds and
qualifies that source before any upload. It takes no package/version inputs and
cannot publish from a feature ref. An absent npm version always requires its
publication source to remain current main. If npm publication already succeeded,
the original native main-source workflow may finish missing tag/release objects after main advances only when
the original native run is intact, its source is an ancestor of current main, and
the registry `gitHead`, repository, archive bytes and integrity match that exact
source build. Conflicting existing tags/releases stop without overwrite. An
ambiguous write is not retried in-process; inspect the original run and retry it
only after checking actual objects. Do not allocate another version to hide a
partial release or publish locally from a feature branch.

## Native exact-version deprecations and audited command equivalents

The separate MangroveAI [official TypeScript publication workflow](https://github.com/MangroveTechnologies/MangroveAI-SDK/blob/main/.github/workflows/typescript-release.yml)
(`release` job; reviewed `version=1.0.0`, `dry_run` and optional exact
`release_commit` recovery inputs) owns the
executable deprecation step, after its successful `@mangrove-ai/sdk` 1.0.0
publication and the verified Markets 0.4.0 prerequisite. This Markets workflow
never runs deprecation. The commands below document that exact scope for review;
they are not a second local execution path or a request for local credentials.
They mark only the three
historical Markets versions; they neither remove archives nor deprecate the
whole `@mangrove-ai/sdk` name. AI 1.0.0 must never receive this message.

```bash
npm deprecate '@mangrove-ai/sdk@0.1.2' 'Legacy MangroveMarkets SDK. Use @mangrove-ai/markets@0.4.0 for Markets; @mangrove-ai/sdk@1.x is the separate MangroveAI product.'
```

```bash
npm deprecate '@mangrove-ai/sdk@0.2.0' 'Legacy MangroveMarkets SDK. Use @mangrove-ai/markets@0.4.0 for Markets; @mangrove-ai/sdk@1.x is the separate MangroveAI product.'
```

```bash
npm deprecate '@mangrove-ai/sdk@0.3.0' 'Legacy MangroveMarkets SDK. Use @mangrove-ai/markets@0.4.0 for Markets; @mangrove-ai/sdk@1.x is the separate MangroveAI product.'
```

After execution, independently read each exact old version's `deprecated` field
and confirm AI 1.0.0 has no such field. Do not substitute a package-wide command,
a wildcard range or a default-tag check for those version-specific checks.

Migration of infrastructure, held frontend review, deployment and funded live
acceptance remain separate. Preparing this source PR performs no publication, tag, deprecation, deployment
or cloud permission change. Human merge starts the normal native publisher as
described above.
