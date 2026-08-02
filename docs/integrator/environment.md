# Environment variable reference

Variables the API reads at startup / runtime (TDD Deployment). The client bundle contains no deployment values. A Vitest check fails when a code-listed deployment variable is missing from the documented-keys block below.

## Documented env keys

```documented-env-keys
CONFIG_PATH
DATABASE_PATH
VAPID_KEYS_PATH
VAPID_SUBJECT
DOCKER_PROXY_URL
ALLOWED_ORIGIN
AUTHELIA_LOGOUT_URL
PORT
LOG_LEVEL
```

## Reference

| Variable              | Default                  | Purpose                                                                | Symptom when wrong                                                                                                                              |
| --------------------- | ------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONFIG_PATH`         | `/config/dashboard.yaml` | Path to the catalog YAML                                               | Missing/unreadable/invalid file → process exits non-zero with `config:` errors before listen.                                                   |
| `DATABASE_PATH`       | `/data/dashboard.db`     | SQLite file on the data volume                                         | Unopenable path or migration failure → exits non-zero with a database error before listen.                                                      |
| `VAPID_KEYS_PATH`     | `/config/vapid.json`     | Integrator-supplied `{ publicKey, privateKey }` JSON                   | Missing file, bad JSON, or missing key fields → exits non-zero with `vapid: VAPID_KEYS_PATH:` (private key is never logged).                    |
| `VAPID_SUBJECT`       | — (required)             | `mailto:` or `https:` contact for web-push                             | Absent/blank → exits non-zero with `vapid: VAPID_SUBJECT:`.                                                                                     |
| `DOCKER_PROXY_URL`    | — (optional)             | Base URL of the read-only Engine API proxy (trailing slashes stripped) | Unset or unreachable → API still serves; status readings are **unknown** rather than down. Wrong URL that refuses connections behaves the same. |
| `ALLOWED_ORIGIN`      | — (required)             | Exact origin accepted by the CSRF `Origin` check                       | Absent → exits non-zero with `env: ALLOWED_ORIGIN is required`. Mismatch → state-changing requests rejected (CSRF).                             |
| `AUTHELIA_LOGOUT_URL` | — (required)             | Returned to the client as `Session.logoutUrl`                          | Absent → exits non-zero with `env: AUTHELIA_LOGOUT_URL is required`. Wrong URL breaks logout UX only.                                           |
| `PORT`                | `3000`                   | API listen port                                                        | Non-integer or outside 1–65535 → exits non-zero with `env: PORT must be...`.                                                                    |
| `LOG_LEVEL`           | `info`                   | One of `debug`, `info`, `warn`, `error`                                | Other value → exits non-zero with `env: LOG_LEVEL must be one of...`.                                                                           |

## VAPID keys file shape (no real keys)

Mount a JSON file; do not commit production private keys. Structure only:

```json
{
  "publicKey": "<integrator-supplied-public-key>",
  "privateKey": "<integrator-supplied-private-key>"
}
```

The private key appears nowhere in this documentation. The example file at `deploy/config/vapid.json` is for local bring-up only and must be replaced for any real deployment.

All hostnames and contacts in [`deploy/compose.example.yaml`](../../deploy/compose.example.yaml) (for example `https://dashboard.example.com`, `mailto:admin@example.com`) are **examples**.
