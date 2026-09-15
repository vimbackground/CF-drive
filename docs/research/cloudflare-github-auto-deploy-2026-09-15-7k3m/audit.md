# Research audit

- Primary-source rule: passed. All supported claims use Cloudflare developer documentation.
- Citation coverage: passed. Deployment, binding, secrets, Git authorization, branch behavior, and rollback links are embedded beside the corresponding tutorial instructions.
- Unsupported-claim control: resource provisioning separation is explicitly labelled as this repository's safety recommendation and ledgered as an inference, not as a platform limitation.
- Worker fallback: two requested recon workers failed before researching because their assigned model was unsupported in this runtime. Their raw error responses and the main-session replacement sources are persisted in `artifacts/`.
