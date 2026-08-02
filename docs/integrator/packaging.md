# Packaging (compose and Caddy)

Shipped as documentation under `deploy/`. Apply these to an existing network that already hosts Caddy, Authelia, and the socket proxy — this project does not start those services.

## Example compose

Full file: [`deploy/compose.example.yaml`](../../deploy/compose.example.yaml).

It builds and runs `dashboard-api` and `dashboard-client` with:

- `container_name` set on both services (required for Caddy upstreams and for any catalog status targets)
- read-only mounts for the catalog YAML and VAPID keys
- a named volume for `/data`
- every TDD Deployment environment variable listed (required ones filled with **example** values)
- join to an **external** network named `proxy` (change the name to match your edge network)

From the repo root:

```bash
docker compose -f deploy/compose.example.yaml up --build
```

## Caddyfile fragment

Full file: [`deploy/Caddyfile.fragment`](../../deploy/Caddyfile.fragment).

Merge the fragment into the existing Caddy site block for the dashboard origin. As written it does three things:

1. **`/api` and `/api/*` behind authentication** — `forward_auth` against Authelia (`authelia:9091` / `/api/authz/forward-auth`), then `reverse_proxy` to `dashboard-api:3000`, copying `Remote-User`, `Remote-Groups`, `Remote-Email`, and `Remote-Name`.
2. **Every other path open** — the default `handle` proxies to `dashboard-client:80` with no `forward_auth`.
3. **Strip inbound `Remote-*`** — before `forward_auth`, deletes `Remote-User`, `Remote-Groups`, `Remote-Email`, and `Remote-Name` so a browser cannot spoof identity. Authelia only overwrites headers it returns; the API trusts them unconditionally once they arrive.

Included here for review (hostnames in comments are examples):

```caddy
# Fragment for the existing Caddy site that fronts the dashboard on one origin.
# Merge into the site block that serves https://dashboard.example.com (or your host).
#
# Assumptions:
# - Authelia is reachable on the docker network as `authelia:9091`
# - `dashboard-api` and `dashboard-client` container_name values match this fragment
# - The socket proxy is not referenced here; the API reaches it via DOCKER_PROXY_URL

# /api → authenticated API. Everything else → static client.
@dashboard_api path /api /api/*

handle @dashboard_api {
	# Strip inbound Remote-* before forward_auth. Authelia only overwrites headers it
	# returns; a client-supplied Remote-User would otherwise reach the API as trusted.
	request_header {
		-Remote-User
		-Remote-Groups
		-Remote-Email
		-Remote-Name
	}

	forward_auth authelia:9091 {
		uri /api/authz/forward-auth
		copy_headers Remote-User Remote-Groups Remote-Email Remote-Name
	}

	reverse_proxy dashboard-api:3000
}

handle {
	reverse_proxy dashboard-client:80
}
```

## One origin

Caddy must serve the client and the API under the same host: `/api` → API (with auth), everything else → client. Do not put the API on a second hostname.
