# Discovery sweep

## Round 1

- queries_and_tools: repository `rg` over Worker, tests, API and technical documentation; Cloudflare official documentation discovery pending
- new_vocabulary: control plane, data plane, hub-and-spoke, single writer, multi-primary, node enrollment, key wrapping, envelope encryption, capability token, split-brain
- new_entities: Cloudflare D1; Cloudflare Workers; Cloudflare R2; Web Crypto API; Durable Objects; Service Bindings
- gaps: exact D1 consistency implications for shared administration; practical trust anchor for encrypting node credentials; whether full UI mirroring is necessary
- negative_results: memory registry search for this repository returned no relevant prior decision
- next_queries: Cloudflare D1 consistency official; Workers service bindings official; D1 encryption at rest official; Web Crypto key wrapping Worker official

## Adjacent-category question

Alternatives that solve the need without calling every instance a peer node: dedicated control-plane Worker, storage-only data-plane Worker, delegated read-only administration, or explicit federation between otherwise independent drives.

## Round 2

- queries_and_tools: pending official-source sweep
- new_vocabulary: pending
- new_entities: pending
- gaps: pending
- negative_results: pending
- next_queries: pending
