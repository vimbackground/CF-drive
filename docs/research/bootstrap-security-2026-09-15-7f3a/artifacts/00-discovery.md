# Discovery sweep

## queries_and_tools

- Cloudflare official documentation: Workers automatic provisioning, Wrangler configuration source of truth, Worker Secrets, D1 data security, and Worker bindings.
- OWASP-oriented initial-admin bootstrap query; no primary source was needed for the central ownership-bootstrap conclusion because it follows from the absence of any pre-existing authentication capability.

## new_vocabulary

- automatic provisioning, binding capability, source of truth, first-admin bootstrap, external trust anchor, password verifier, signing key rotation.

## new_entities

- Cloudflare Wrangler configuration: automatic R2/D1 provisioning and configuration precedence.
- Cloudflare Worker bindings: a D1 binding grants the Worker capability to access D1 without embedding an account token.
- Cloudflare D1 data security: D1 encryption at rest and in transit.

## gaps

- No Cloudflare-managed mechanism can infer which anonymous first request belongs to the deployment owner without an external identity or pre-shared secret.

## negative_results

- Query: self-contained anonymous first-admin setup with no pre-shared value or external identity; result: no secure ownership discriminator exists by design.

## next_queries

- None required before the user selects a bootstrap trust model.
