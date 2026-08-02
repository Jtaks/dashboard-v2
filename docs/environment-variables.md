# Environment variables

Read by `readEnv()` in `packages/api/src/lib/env.ts` at API startup. Every variable below must appear in this document. `pnpm check:docs` fails when `ENV_VARIABLES` and this file disagree.

| Variable | Default | Required | Purpose | Wrong value symptom |
| -------- | ------- | -------- | ------- | ------------------- |
| `CONFIG_PATH` | `/config/dashboard.yaml` | no | Path to the YAML configuration file | Missing or unreadable file → error logged, exit non-zero |
| `DATABASE_PATH` | `/data/dashboard.db` | no | SQLite database file on a mounted volume | Unwritable path → database open or migration fails, exit non-zero |
| `VAPID_KEYS_PATH` | `/config/vapid.json` | no | JSON file with `publicKey` and `privateKey` | Missing file, invalid JSON, or schema violation → error logged, exit non-zero |
| `VAPID_SUBJECT` | — | yes | `mailto:` or `https:` contact URI for Web Push | Empty → `VAPID_SUBJECT is required` logged, exit non-zero; push endpoints unavailable |
| `DOCKER_PROXY_URL` | — | yes | Base URL of the read-only Docker socket proxy | Empty → status collection treats proxy as unreachable; all container status `unknown` |
| `ALLOWED_ORIGIN` | — | yes | Origin accepted by the CSRF check on `POST`, `PATCH`, `DELETE` | Empty or mismatch → state-changing API calls return `403` with `origin_mismatch`; reads still work |
| `AUTHELIA_LOGOUT_URL` | — | yes | Logout URL returned to the client as `Session.logoutUrl` | Empty → client receives empty `logoutUrl`; logout link in UI does nothing useful |
| `PORT` | `3000` | no | API listen port inside the container | Non-numeric → falls back to `3000` |
| `LOG_LEVEL` | `info` | no | Application log level | Unrecognised value passed to logger; behaviour depends on logger implementation |

## Notes

- The private VAPID key is read from `VAPID_KEYS_PATH` only at startup. It is never returned by `/api/push/key` (public key only).
- `ALLOWED_ORIGIN` must match the browser origin exactly, including scheme and host, for example `https://dashboard.example.com` with no trailing slash.
- `DOCKER_PROXY_URL` trailing slashes are stripped before requests; both `http://socket-proxy:2375` and `http://socket-proxy:2375/` work.
- Example values in `docker-compose.example.yml` use `example.com` hostnames only.
