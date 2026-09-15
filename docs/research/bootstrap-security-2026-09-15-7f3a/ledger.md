# Claim ledger

| ID | Claim | Evidence | Status | Applicability |
| --- | --- | --- | --- | --- |
| C1 | Workers Builds can automatically provision fresh R2 and D1 resources from bindings without resource identifiers. | https://developers.cloudflare.com/workers/wrangler/configuration/ | confirmed | Current `wrangler.toml` auto-provisioning flow |
| C2 | A Worker binding grants the Worker access to a D1 resource without embedding account API credentials in the Worker. | https://developers.cloudflare.com/workers/runtime-apis/bindings/ | confirmed | D1-backed application configuration |
| C3 | D1 data is encrypted at rest and in transit, but Cloudflare account principals that can access the database remain part of the trust boundary. | https://developers.cloudflare.com/d1/reference/data-security/ | confirmed | D1-stored password verifiers and generated signing material |
| C4 | An anonymous first request cannot be distinguished from the deployment owner if no pre-shared secret or external identity exists. | Threat-model deduction from the request model | confirmed | First-admin setup endpoint |

## Hypothesis matrix

| ID | Candidate | Status | Discriminator |
| --- | --- | --- | --- |
| H1 | Allow the first anonymous visitor to create the administrator. | rejected | Any third party can visit first and permanently take ownership. |
| H2 | Require a one-time credential or external identity only for bootstrap, then manage all application settings inside the instance. | preferred | Only a verified deployment owner can complete setup. |
| H3 | Keep every runtime secret in Cloudflare settings permanently. | conditional | Secure but conflicts with the requested self-managed application configuration. |
