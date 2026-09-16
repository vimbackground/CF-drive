# Cloudflare platform recon

## Confirmed claims

- `e1c5-cf-01`: D1 automatically encrypts stored objects and traffic, with keys managed by Cloudflare. Source: https://developers.cloudflare.com/d1/reference/data-security/
- `e1c5-cf-02`: Worker Secrets and Secrets Store are intended for API keys and tokens and do not reveal saved values in the dashboard. Sources: https://developers.cloudflare.com/workers/configuration/secrets/ and https://developers.cloudflare.com/secrets-store/integrations/workers/
- `e1c5-cf-03`: Workers Web Crypto supports AES-GCM encrypt/decrypt operations. Source: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
- `e1c5-cf-04`: Service Bindings let a Worker call another Worker without a public URL; documented configuration targets a Worker in the caller's Cloudflare account. Source: https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/
- `e1c5-cf-05`: D1 native replication uses one writable primary and asynchronous read replicas; Sessions API provides sequentially consistent reads. Source: https://developers.cloudflare.com/d1/best-practices/read-replication/

## Findings

- D1 at-rest encryption does not replace application-level credential encryption with a key outside D1.
- A Worker Secret or Secrets Store binding is the appropriate location for a D1 credential-wrapping key.
- Same-account deployments may use Service Bindings as a private fast path; cross-account nodes still need explicit HTTPS authentication.
- Cloudflare's D1 replication is not a multi-primary synchronization mechanism for two independent application databases.

