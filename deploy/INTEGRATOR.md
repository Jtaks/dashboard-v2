# Integrator notes for packaging shipped by A7

This project owns two images (`Dockerfile.client`, `Dockerfile.api`), an example
compose file, and a Caddyfile fragment. Caddy, Authelia, LLDAP, the docker
network, the socket proxy, and the applications being listed are existing
infrastructure and are assumed already correct.

## What the fragment assumes

- **Authelia** is on the same docker network as Caddy and the dashboard containers,
  reachable at hostname `authelia` on port `9091` (Authelia's default). The
  fragment calls `forward_auth` against `/api/authz/forward-auth` and copies
  `Remote-User`, `Remote-Groups`, `Remote-Email`, and `Remote-Name` onto the
  request that reaches the API.
- **Socket proxy** is a separate read-only Docker Engine API proxy already on the
  network. Compose does not start it. Point `DOCKER_PROXY_URL` at its base URL
  (example: `http://socket-proxy:2375`). The API never mounts the docker socket.
- **One origin.** Caddy serves the client and the API under the same host:
  `/api` → API (with auth), everything else → client. Do not put the API on a
  second hostname.
- **Inbound `Remote-*` strip.** The fragment deletes those headers before
  `forward_auth` runs so a browser cannot spoof identity. The API trusts the
  headers unconditionally once they arrive.

## `container_name` is required

Compose only produces a predictable container name when `container_name` is set.
Anything this stack names must set it:

- **Caddy upstreams** in the fragment (`dashboard-api`, `dashboard-client`, and
  `authelia`) resolve by container name on the shared network.
- **Status targets** in `dashboard.yaml` under each service's `containers` list
  are matched literally against the Engine API. A service whose compose file omits
  `container_name` will not match and is reported down.

The example compose sets `container_name` on both dashboard services. Application
stacks you list in config must do the same for every container you want status for.

## Bringing the example up

1. Ensure the external network named `proxy` exists (or change `networks.proxy.name`
   in `compose.example.yaml`).
2. Edit `deploy/config/dashboard.yaml` for your catalog.
3. Replace `deploy/config/vapid.json` with integrator-generated VAPID keys
   (`{ "publicKey", "privateKey" }`). The project neither generates nor stores
   production keys; the example file is for local bring-up only. Mount path
   defaults to `VAPID_KEYS_PATH` (`/config/vapid.json`).
4. Set the compose environment values that have no TDD default:
   `ALLOWED_ORIGIN`, `AUTHELIA_LOGOUT_URL`, `DOCKER_PROXY_URL`, and
   `VAPID_SUBJECT` (`mailto:` or `https:` contact required by web-push).
5. Apply `Caddyfile.fragment` to the existing Caddy site for the dashboard origin.
6. From the repo root:
   `docker compose -f deploy/compose.example.yaml up --build`

The API starts with a mounted config, VAPID keys, and an empty `/data` volume. It
exits non-zero with a logged error if the config file, VAPID keys file, or
`VAPID_SUBJECT` is missing or invalid — before the HTTP listener binds.
