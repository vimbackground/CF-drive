# Recon report

Official Cloudflare documentation supports a direct GitHub-to-Workers deployment path through Workers Builds. The selected production branch triggers a build and deploy; a build command may run `npm run verify` before the default `npx wrangler deploy`. R2 and D1 use distinct binding declarations. D1 requires the database ID output when it is created, so this implementation uses a one-time explicit resource bootstrap, commits the non-secret binding config, and manages all passwords as deployed Worker secrets.

The applied tutorial defaults the Worker, R2 bucket and D1 database names to `cf-drive`; it disables non-production branch builds until isolated preview resources are configured.
