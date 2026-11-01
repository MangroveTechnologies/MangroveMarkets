# Website deployment

The [website workflow](../.github/workflows/deploy-website.yaml) builds the
static Next.js export with the frozen pnpm lockfile and publishes it to the
existing Firebase Hosting site `mangrove-markets`. It runs only from this
repository's main branch, on the existing push/manual events.

The workload-provider resource name and deployment-account email in the
workflow are public identifiers, not credentials. GitHub supplies the short
lived OIDC credential. No downloaded service-account key or separate GitHub
secret containing these identifiers is needed.

The source configuration alone does not authorize impersonation. The owning
Terraform root in `MangroveMarkets-MCP-Server/infra/terraform/hosting-ci.tf`
declares an additive member for the exact
`repo:MangroveTechnologies/MangroveMarkets:ref:refs/heads/main` subject on the
existing deployment account. The previous owner-name grant does not match this
repository. See [issue65](https://github.com/MangroveTechnologies/MangroveMarkets/issues/65)
and the separate [existing infrastructure reconciliation PR95](https://github.com/MangroveTechnologies/MangroveMarkets-MCP-Server/pull/95).
The infrastructure owner must review the full actual-backend plan before any
member apply; this workflow change performs no IAM or provider-trust update.

After that reviewed setup and human source merges, run:

```bash
gh workflow run deploy-website.yaml --repo MangroveTechnologies/MangroveMarkets --ref main
```

Verify the native run's selected source, static build, Google authentication and
Hosting release, then compare all deployed application-file hashes and links to
the build. A successful local build does not establish deployment success.

The 2026-11-01 application release used the already-authenticated team identity
with the documented [Hosting REST release protocol](https://firebase.google.com/docs/hosting/api-deploy),
without changing DNS, IAM, service configuration or provider trust. Its version
is `4d89ebf9ca722455`, built from merged commit `ffda6830`; the prior Hosting
version `7e01e6f7f1d69d90` remains available for rollback. That fallback is a
dated delivery record, not a claim that the GitHub authentication gap is fixed.
