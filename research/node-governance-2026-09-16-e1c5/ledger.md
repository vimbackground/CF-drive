# Claim Ledger

| claim_id | status | importance | evidence |
|---|---|---|---|
| e1c5-repo-01 | confirmed | central | `worker.js:3943-3994` |
| e1c5-repo-02 | confirmed | central | `worker.js:2814-2829`, `worker.js:3955-3964`, `worker.js:7198-7217` |
| e1c5-repo-03 | confirmed | central | `worker.js:4471-4486`, `worker.js:5953-5965` |
| e1c5-repo-04 | confirmed | supporting | `worker.js:7524-7581`, `worker.js:7613-7645` |
| e1c5-repo-05 | confirmed | central | `worker.js:6845-6895` |
| e1c5-repo-06 | confirmed | central | `worker.js:6143-6161`, `worker.js:7224-7233` |
| e1c5-cf-01 | confirmed | central | Cloudflare D1 data security |
| e1c5-cf-02 | confirmed | central | Cloudflare Worker Secrets and Secrets Store |
| e1c5-cf-03 | confirmed | supporting | Cloudflare Workers Web Crypto |
| e1c5-cf-04 | confirmed | supporting | Cloudflare Service Bindings |
| e1c5-cf-05 | confirmed | supporting | Cloudflare D1 read replication |

# Hypothesis Matrix

## H1 — A and B are both writable managers

- type: decision
- supporting_claim_ids: e1c5-cf-05
- contradicting_claim_ids: e1c5-repo-03, e1c5-repo-05, e1c5-repo-06
- discriminator_or_falsifier: demonstrate one canonical metadata database, unified identity, deterministic write routing, conflict handling, and access to every storage backend from both entrypoints
- status: rejected for the current architecture
- residual_uncertainty: It could be rebuilt as two frontends over one control plane, but that is not independent dual-primary management.

## H2 — B loses every management capability after joining A

- type: decision
- supporting_claim_ids: e1c5-repo-05
- contradicting_claim_ids: e1c5-repo-06
- discriminator_or_falsifier: prove A failure cannot prevent B credential revocation, detachment, recovery, or diagnostics
- status: conditional
- residual_uncertainty: Simple and safe for normal operation, but insufficient for break-glass recovery.

## H3 — A is the sole global controller; B retains limited local node maintenance

- type: decision
- supporting_claim_ids: e1c5-repo-01, e1c5-repo-03, e1c5-repo-04, e1c5-repo-05, e1c5-repo-06, e1c5-cf-02, e1c5-cf-03, e1c5-cf-04
- contradicting_claim_ids: none decisive
- discriminator_or_falsifier: fail to provide secure enrollment, scoped link credentials, break-glass revocation, drain-before-detach, or a single canonical metadata authority
- status: active
- residual_uncertainty: Cross-account deployments require public HTTPS authentication; same-account deployments can optionally use Service Bindings.

## Matrix outcome

- matrix_outcome: preferred
- preferred_hypothesis_id: H3

# Warrant gate

- claim: H3 is the most suitable design.
- evidence_ids: e1c5-repo-01, e1c5-repo-03, e1c5-repo-05, e1c5-repo-06, e1c5-cf-02, e1c5-cf-03
- warrant: A single metadata writer matches the current one-instance D1 model, while limited B-side maintenance preserves revocation and recovery without introducing dual-primary conflicts.
- qualifier: Preferred for the current project and its expected cross-account node topology.
- key_defeater: If all entrypoints can be proven to use one shared control plane and unified identity, multiple UI entrypoints are acceptable, but they remain frontends rather than independent masters.
