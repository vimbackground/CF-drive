# Claim ledger

| ID | Claim | Evidence | Status | Applicability |
| --- | --- | --- | --- | --- |
| C1 | Workers Builds can deploy a connected GitHub repository when a selected branch receives a push. | [CI/CD](https://developers.cloudflare.com/workers/ci-cd/), [Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) | supported | GitHub-hosted repositories connected to Workers Builds |
| C2 | Workers Builds runs an optional build command then a deploy command; production defaults to `npx wrangler deploy`. | [Build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) | supported | Worker configured through Builds |
| C3 | D1 creation returns the binding configuration including a unique database ID. | [D1 getting started](https://developers.cloudflare.com/d1/get-started/) | supported | New D1 database |
| C4 | R2 bucket binding uses `binding` and `bucket_name` in Wrangler config. | [R2 Worker binding](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/) | supported | Worker using R2 |
| C5 | Secrets should not be stored in Wrangler `vars` or committed local files; deployed secrets are managed per Worker. | [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/) | supported | All deployments |
| C6 | Do not provision resources in every push-triggered production deploy. | Inference from C2/C3; resource creation allocates state and D1 ID before binding. | recommendation | This repository's fresh deployment path |

## Hypothesis matrix

| Option | Assessment | Decision |
| --- | --- | --- |
| Workers Builds + GitHub | Native Git connection, branch-controlled deployment and no CI API token stored in Git. | selected |
| GitHub Actions deploy | Viable external CI/CD option but requires separate Cloudflare credential lifecycle. | not selected for default |
| Dashboard copy/paste | Works for emergency/manual use but does not provide source-controlled automatic deployment. | fallback only |
