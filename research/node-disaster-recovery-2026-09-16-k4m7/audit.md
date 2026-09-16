# Mini assurance

## Evidence checks

- Current-state claims C1-C6 were checked against repository code and documentation with line locators.
- Storage claims C7-C14 use official Ceph or Cloudflare documentation; no aggregate source is load-bearing.
- No claim is made that Cloudflare R2 itself lacks internal redundancy. The threat model is application-level loss of a Worker/account/control credential, which R2 durability does not by itself solve.
- The failed specialized web-research agent produced no evidence and was replaced by a successful fallback worker.

## Warrant checks

### W1

- claim: Scheme 2 should be implemented first.
- evidence IDs: C3, C4, C13.
- warrant: The current architecture already has most data movement primitives, while safe migration is also required later for node repair, EC backfill and retirement.
- qualifier: First engineering priority, not sufficient disaster recovery by itself.
- key defeater: If managed-node data must survive an immediate unplanned loss before any migration window, replication must ship in the same release rather than later.

### W2

- claim: With two independent failure domains, RF=2 is preferable to no protection; 2+1 EC begins at three independent domains.
- evidence IDs: C1, C2, C7, C8, C9.
- warrant: Two full copies can survive either one-domain loss without parity reconstruction; 2+1 requires three shard targets and a reconstruction path.
- qualifier: RF=2 costs approximately twice logical data storage at the application layer.
- key defeater: A user may explicitly choose an unprotected capacity mode and accept loss.

### W3

- claim: Controller role conversion must be a planned handover protocol before it can become disaster failover.
- evidence IDs: C5, C6, C11, C12.
- warrant: B currently lacks authoritative control metadata and credentials, and native D1 read/restore mechanisms do not create a new writable cross-account control plane.
- qualifier: Planned switchover with a maintenance window is feasible; automatic promotion is a later capability.
- key defeater: An external independent control-plane database/consensus service would materially change the design.

## Result

- Evidence coverage: sufficient for architecture recommendation.
- Remaining empirical gap: Worker-side erasure coding performance and migration throughput require prototypes before implementation commitment.
- External paid Deep Research: not required.
