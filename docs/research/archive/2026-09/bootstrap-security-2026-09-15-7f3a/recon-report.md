# Quick recon result

Cloudflare can create R2 and D1 automatically on the first deployment, and the Worker can safely use its D1 binding without embedding an account API token. D1 is therefore suitable for user-editable application configuration, password verifiers, and server-generated signing keys that are never returned by the API.

The requested removal of all Cloudflare dashboard initialization cannot safely include the first-administrator trust decision. With no external secret or authenticated identity, an anonymous first-setup page lets any party who reaches the Worker first claim the instance. A one-time bootstrap credential or external identity is required; after that one step, all application configuration can be managed in the instance UI.
