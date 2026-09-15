# Recon report

Official Cloudflare documentation supports a direct GitHub-to-Workers deployment path through Workers Builds. The selected production branch triggers a build and deploy; a build command may run `npm run verify` before the default `npx wrangler deploy`. R2 and D1 use distinct binding declarations. This implementation leaves their names and IDs absent, so the first deployment automatically provisions fresh resources and retains all passwords as deployed Worker secrets.

The applied tutorial defaults the Worker name to `cf-drive`; Cloudflare-generated R2 and D1 names use that prefix. It disables non-production branch builds until isolated preview resources are configured.
