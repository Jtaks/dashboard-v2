# Integrator documentation

This project owns two images (`Dockerfile.client`, `Dockerfile.api`), a YAML catalog the integrator mounts into the API, and the packaging examples under `deploy/`. Everything else — Caddy, Authelia, LLDAP, the docker network, the socket proxy, and the applications being listed — is existing infrastructure this project neither owns nor tests.

Use these pages to bring the dashboard up without reading the source:

| Document                                      | Contents                                          |
| --------------------------------------------- | ------------------------------------------------- |
| [Prerequisites](./prerequisites.md)           | What each external component must already provide |
| [Configuration reference](./configuration.md) | Every YAML key the schema accepts                 |
| [Environment variables](./environment.md)     | Every variable the API reads                      |
| [Packaging](./packaging.md)                   | Example compose file and Caddyfile fragment       |
| [First-run walkthrough](./walkthrough.md)     | Empty directory → working dashboard               |

## Surprising rules (read these first)

1. **`containers` holds literal names.** Compose only produces a predictable name when `container_name` is set. Every container this stack or your catalog names must set it — Caddy upstreams (`dashboard-api`, `dashboard-client`, `authelia`) and every name under a service's `containers` list.
2. **Top-level `groups` is the topic vocabulary.** The API cannot enumerate the directory; it only ever sees one user's groups on a header. An application or service that references a group not in that list fails validation at startup.
3. **Visibility is OR across groups.** An application (or service) is visible when any of its `groups` appears in `Remote-Groups`. Members of `adminGroup` see everything.
4. **Restart to reload.** Config is read and validated once at startup. There is no reload endpoint; apply an edit by restarting the API.

## Examples are marked

Hostnames, group names, origins, and key material in these docs and under `deploy/` are **examples** (for instance `dashboard.example.com`, `media-users`, `mailto:admin@example.com`). None are production values. The private VAPID key must never appear in documentation or logs; supply it only via the mounted keys file.
