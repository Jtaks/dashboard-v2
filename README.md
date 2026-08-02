# dashboard v2

An AI experiment.

## Packages

| Package  | Role                           |
| -------- | ------------------------------ |
| `shared` | Types shared by client and API |
| `api`    | Node service (Hono)            |
| `client` | SvelteKit static client        |

## Integrator docs

Deploying the two images behind an existing Caddy/Authelia stack: **[docs/integrator/](./docs/integrator/README.md)** (packaging examples under `deploy/`).

## Scripts

From the repo root, after `pnpm install`:

- `pnpm dev` — watch all packages
- `pnpm build` — build all packages
- `pnpm test` — Vitest (api, shared) and Playwright (client)
- `pnpm lint` — ESLint + Prettier check
- `pnpm format` — Prettier write
