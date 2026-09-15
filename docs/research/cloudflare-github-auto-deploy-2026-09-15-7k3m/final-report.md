# Final research conclusion

For a new CF-drive deployment, use Cloudflare Workers Builds connected directly to GitHub. Set `main` as the production branch, `npm run verify` as the build command, and `npx wrangler deploy` as the deploy command. Commit a non-secret `wrangler.toml` that declares `R2_BUCKET` and `DB` without resource names or IDs; Cloudflare automatically provisions fresh R2 and D1 resources on the first deploy. Keep all passwords and tokens in Cloudflare Worker Secrets, not Git.

The implementation is delivered in `docs/GITHUB_CLOUDFLARE_DEPLOYMENT.md`, with matching defaults in `wrangler.toml`, `docs/DEPLOYMENT.md`, `README.MD`, and `docs/TECHNICAL_DOC.MD`.
