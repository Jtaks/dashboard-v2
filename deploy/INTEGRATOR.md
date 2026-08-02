# Dashboard integrator notes

Full integrator documentation lives in [`docs/integrator.md`](../docs/integrator.md), including prerequisites, configuration and environment variable references, compose and Caddyfile fragments, and a first-run walkthrough.

Quick reference:

- [Configuration keys](../docs/config-reference.md)
- [Environment variables](../docs/environment-variables.md)
- [`docker-compose.example.yml`](../docker-compose.example.yml)
- [`deploy/Caddyfile.fragment`](./Caddyfile.fragment)

## Routing summary

Use `deploy/Caddyfile.fragment` inside the dashboard site block:

- Requests under `/api` are authenticated with `forward_auth`, receive the `Remote-*` headers copied from Authelia, and are proxied to `dashboard-api`.
- All other paths are served by `dashboard-client`, which is a static bundle with SPA fallback.
- Inbound `Remote-*` headers are stripped before `forward_auth` so a client cannot spoof identity.

## Local verification

After merging the Caddyfile fragment on the existing gateway, confirm:

- `/` serves the static client without authentication.
- `/api/session` requires authentication and receives identity headers from Authelia.
- A request that already carries `Remote-User` reaches the API without it.

```sh
docker compose -f docker-compose.example.yml build
docker compose -f docker-compose.example.yml up
```

## Doc drift check

```sh
pnpm check:docs
```
