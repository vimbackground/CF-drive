# Repository current-state recon

## Confirmed claims

- `e1c5-repo-01`: Node records retain a plaintext `token`, and `saveStorageNodes()` serializes the sanitized array into D1 under `storage_nodes` (`worker.js:3943-3994`).
- `e1c5-repo-02`: The management response hides the token, but creation accepts it from the browser (`worker.js:2814-2829`, `worker.js:3955-3964`, `worker.js:7198-7217`).
- `e1c5-repo-03`: Each initialized instance receives one instance-wide `storageNodeToken`; `/api/node/*` compares a Bearer value against it (`worker.js:4471-4486`, `worker.js:5953-5965`, `worker.js:6319-6332`).
- `e1c5-repo-04`: Temporary upload sessions contain node tokens, while permanent manifests omit them (`worker.js:7524-7581`, `worker.js:7613-7645`).
- `e1c5-repo-05`: The main handler validates R2/D1 and loads application config before dispatching node APIs, so a distinct managed-node mode does not yet exist (`worker.js:6845-6895`).
- `e1c5-repo-06`: Removing a node record does not check manifest references; old manifests depend on the current node table to recover credentials (`worker.js:6143-6161`, `worker.js:7224-7233`).

## Findings

- The current implementation is manual shared-token configuration, not enrollment.
- Tokens are omitted from public management responses but are not encrypted in D1.
- One token per instance prevents link-level revocation and auditing.
- Permanent manifest format already avoids credential persistence and can remain compatible.

