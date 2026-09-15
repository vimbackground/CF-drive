# Final research conclusion

For a new CF-drive deployment, use Cloudflare Workers Builds connected directly to GitHub. Set `main` as the production branch, `npm run verify` as the build command, and `npx wrangler deploy` as the deploy command. First create the R2 bucket and D1 database as `cf-drive`; then commit a non-secret `wrangler.toml` that binds `R2_BUCKET` and `DB`, including the D1 ID created by Cloudflare. Keep all passwords and tokens in Cloudflare Worker Secrets, not Git.

The implementation is delivered in `docs/GITHUB_CLOUDFLARE_DEPLOYMENT.md`, with matching defaults in `wrangler.toml.example`, `docs/DEPLOYMENT.md`, `README.MD`, and `docs/TECHNICAL_DOC.MD`.
