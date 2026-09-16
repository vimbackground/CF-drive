# Discovery sweep (coverage record, not evidence)

## Round 1

### queries_and_tools

- Web search: `site:developers.cloudflare.com/r2 durability replication data loss consistency R2`
- Web search: `site:developers.cloudflare.com/d1 Time Travel backup restore D1`
- Web search: `site:docs.ceph.com erasure coding minimum failure domains k m`
- Web search: `site:docs.aws.amazon.com S3 replication failover disaster recovery object storage`
- Local index: `rg` over `worker.js`, `docs`, and tests for allocation, manifests, draining, retries, migration, replication, and failover.

### new_vocabulary

- erasure coding; `k+m`; failure domain; replication factor; backfill; rebalancing
- control plane promotion; active-passive; manifest authority; fencing; split brain
- live replication; batch replication; point-in-time recovery; bucket lock

### new_entities

Lead list only; each item must be grounded again before citation:

- Cloudflare R2 durability and consistency documentation
- Cloudflare D1 Time Travel
- Cloudflare Workers Workflows and Queues
- Ceph erasure-coded pools and CRUSH failure domains
- Amazon S3 live/batch replication and failover
- RAID5 / Reed-Solomon erasure coding

### gaps

- Whether R2 exposes account-to-account native replication suitable for this project.
- Exact current-code identity dependencies during controller promotion.
- Small-node-count economics: two replicas versus parity coding.

### negative_results

- Query `site:docs.ceph.com erasure coding minimum failure domains k m` in the first general search batch returned no surfaced Ceph result.
- Local code search found no implemented replica set, parity shard, automatic backfill, or control-plane election path.

### next_queries

- Ceph `k m failure domains`, R2 bucket locks, Workers execution limits, and object replication alternatives.

## Round 2

### queries_and_tools

- Web search: `site:docs.ceph.com/en/latest/rados/operations/erasure-code k m failure domains`
- Web search: `site:docs.min.io object replication active passive disaster recovery`
- Web search: `site:developers.cloudflare.com/r2 bucket locks accidental deletion object versioning replication`
- Web search: `site:developers.cloudflare.com/workers/platform limits request duration CPU duration subrequests`

### new_vocabulary

- storage overhead `(k+m)/k`; maintenance unavailability; recovery/backfill performance
- object retention/bucket locks; streaming migration; resumable jobs; idempotent copy

### new_entities

- Ceph erasure code profile (`k`, `m`, `crush-failure-domain`)
- Cloudflare R2 Bucket Locks
- Cloudflare Workers invocation and subrequest limits

### gaps

- Product-specific R2 cross-account replication did not surface as a native feature in this sweep.
- Exact migration throughput remains deployment- and plan-dependent.

### negative_results

- Query `site:docs.min.io object replication active passive disaster recovery` did not surface a MinIO result in the returned set.
- No official R2 native cross-account replication page surfaced from the R2 replication query set.

### next_queries

- No third discovery round: Round 2 added operational constraints but no new decision-changing architecture family.

## Adjacent-category question

The same need can be solved without calling it RAID: full-object/part replication, immutable backup plus restore, or active-passive control-plane promotion with a migration journal. These remain candidates for Round 1 assessment.

