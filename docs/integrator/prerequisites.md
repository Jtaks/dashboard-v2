# Prerequisites

Each external component must already provide the capability below. This page states **what** is required, not how to configure it.

| Component | Must provide |
| --------- | ------------ |
| **Caddy** | The only ingress for the dashboard origin. Carries the `forward_auth` rule on `/api` and strips inbound `Remote-*` headers before Authelia runs (see [Packaging](./packaging.md)). Serves client and API under one origin. |
| **Authelia** | Asserts the authenticated user's groups (and identity headers) for requests that pass `forward_auth`. Reachable from Caddy on the shared docker network. |
| **LLDAP** | Holds the group names the catalog YAML references in top-level `groups` and in application/service `groups` lists. |
| **Socket proxy** | A read-only Docker Engine API proxy reachable at `DOCKER_PROXY_URL`. The API never mounts the docker socket. |
| **VAPID key pair** | Integrator-supplied `{ publicKey, privateKey }` JSON at `VAPID_KEYS_PATH`, plus a `VAPID_SUBJECT` contact. The project neither generates nor stores the keys. |

Also assumed already correct: the shared docker network the example compose joins, and the application containers named in the catalog (each with `container_name` set if you want status).
