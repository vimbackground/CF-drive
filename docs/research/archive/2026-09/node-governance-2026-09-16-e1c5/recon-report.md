# Storage-node credential and governance recommendation

Recommend a single global controller with limited local node maintenance. A owns the canonical file tree, shares, manifests and node lifecycle. B in managed-node mode serves scoped storage APIs and exposes only health, controller identity, credential rotation/revocation, drain/detach and emergency recovery. B may redirect or proxy its public file-management URL to A, but must not maintain an independently writable copy of A's metadata.

Replace the current instance-wide plaintext node token with a per-link credential. During one-time enrollment B issues a random link token, stores only its verifier, and returns the plaintext once over TLS. A encrypts the token with AES-256-GCM and stores ciphertext, IV, key ID and metadata in D1. The wrapping key must live outside D1 in a Worker Secret or Secrets Store binding. Old plaintext tokens must never be queryable; only create, rotate and revoke operations are exposed.

Implement explicit instance modes (`standalone`, `controller`, `managed_node`) and node lifecycle states (`pending`, `active`, `draining`, `retired`, `revoked`). Do not allow hard deletion while manifests reference a node. Credential rotation should preserve node ID and support a bounded old/new credential grace window.
