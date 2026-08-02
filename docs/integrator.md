# Integrator guide

Documentation for deploying the dashboard into an existing homelab stack. This project ships two container images and a YAML configuration file; everything else — Caddy, Authelia, LLDAP, the Docker socket proxy, and the applications being listed — is existing infrastructure assumed correct. This guide states what each external component must provide, not how to configure it.

**Example values** throughout this document use `example.com` hostnames and placeholder keys. Replace them with your deployment values. A private VAPID key never appears here; you supply it at runtime.

## What you ship

| Artifact | Purpose |
| -------- | ------- |
| `Dockerfile.client` | Static file server for the Svelte client bundle |
| `Dockerfile.api` | Node API for catalog, status, alerts, and push |
| `dashboard.yaml` | Application catalog, group vocabulary, and container names for status |

See also:

- [Configuration reference](./config-reference.md) — every YAML key with types, defaults, and failure behaviour
- [Environment variables](./environment-variables.md) — every variable the API reads at startup

Bundled deployment fragments (from A7):

- [`docker-compose.example.yml`](../docker-compose.example.yml) — example compose file
- [`deploy/Caddyfile.fragment`](../deploy/Caddyfile.fragment) — Caddy routing for `/api` auth and static client

## Prerequisites

Each component must already be running on a Docker network the dashboard containers can join (the example compose uses an external network named `homelab`).

| Component | Must provide |
| --------- | ------------ |
| **Caddy** | TLS termination for the dashboard origin; `forward_auth` to Authelia on `/api/*`; inbound `Remote-*` header strip before `forward_auth`; static client paths without authentication |
| **Authelia** | Forward-auth endpoint reachable from Caddy (example fragment uses `authelia:9091`); asserts identity and copies `Remote-User`, `Remote-Groups`, `Remote-Email`, and `Remote-Name` on authorised `/api` requests |
| **LLDAP** | Group membership that Authelia forwards; every group name referenced in `dashboard.yaml` must exist in this directory |
| **Socket proxy** | Read-only Docker API proxy reachable at the URL you set in `DOCKER_PROXY_URL` (example: `http://socket-proxy:2375`) |
| **VAPID keys** | A key pair in JSON at `VAPID_KEYS_PATH`; the integrator generates and mounts this file — the project neither generates nor stores the private key |

## Rules that surprise people

1. **`containers` holds literal names.** Status lookups match the exact `container_name` from each application's compose file. Compose only produces a predictable name when `container_name` is set. A name that matches nothing is reported as `down` and logged as a warning (`Container not found in daemon`).

2. **Top-level `groups` is the topic vocabulary.** The API cannot enumerate LLDAP; it only sees one user's groups per request on the `Remote-Groups` header. Every group referenced by an application or service must appear in this list. A reference to a group not in the list is a validation error at startup.

3. **Visibility is OR across groups.** An application is visible when any entry in its `groups` appears in `Remote-Groups`. Members of `adminGroup` see everything. A service may narrow visibility with its own `groups`; omitted means it inherits the application's groups.

4. **No config reload.** The API reads and validates YAML once at startup. Edit the file and restart the `dashboard-api` container to apply changes.

5. **Unrecognised YAML keys are warnings, not errors.** A newer config file against an older image logs `Unrecognized config key "…" ignored` and continues. Missing or malformed required values exit non-zero.

6. **Client image is generic.** The client bundle contains no deployment values. The VAPID public key is fetched from `/api/push/key` at runtime.

## Routing

Merge [`deploy/Caddyfile.fragment`](../deploy/Caddyfile.fragment) into the Caddy site block that already terminates TLS for the dashboard origin:

```caddyfile
# Caddyfile fragment for the dashboard client and API.
# Merge into the site block that already terminates TLS for the dashboard origin.

@dashboard_api path /api/*

route @dashboard_api {
	# Strip inbound identity headers before forward_auth runs.
	header -Remote-User
	header -Remote-Groups
	header -Remote-Email
	header -Remote-Name

	forward_auth authelia:9091 {
		uri /api/authz/forward-auth
		copy_headers Remote-User Remote-Groups Remote-Email Remote-Name
	}

	reverse_proxy dashboard-api:3000
}

# Everything else is the unauthenticated static client.
reverse_proxy dashboard-client:80
```

Behaviour:

- Requests under `/api` are authenticated with `forward_auth`, receive `Remote-*` headers copied from Authelia, and are proxied to `dashboard-api`.
- All other paths are served by `dashboard-client`, which is a static bundle with SPA fallback.
- Inbound `Remote-*` headers are stripped before `forward_auth` so a client cannot spoof identity.
- `/` serves the static client without authentication.
- `/api/session` requires authentication and receives identity headers from Authelia.
- A request that already carries `Remote-User` reaches the API without it (the strip runs before `forward_auth`).

## Example compose file

[`docker-compose.example.yml`](../docker-compose.example.yml):

```yaml
services:
  dashboard-client:
    build:
      context: .
      dockerfile: Dockerfile.client
    container_name: dashboard-client
    networks:
      - homelab
    restart: unless-stopped

  dashboard-api:
    build:
      context: .
      dockerfile: Dockerfile.api
    container_name: dashboard-api
    networks:
      - homelab
    restart: unless-stopped
    environment:
      # Defaults from TDD Deployment; replace example values before production.
      CONFIG_PATH: /config/dashboard.yaml # default: /config/dashboard.yaml
      DATABASE_PATH: /data/dashboard.db # default: /data/dashboard.db
      VAPID_KEYS_PATH: /config/vapid.json # default: /config/vapid.json
      VAPID_SUBJECT: mailto:admin@example.com # required; no default
      DOCKER_PROXY_URL: http://socket-proxy:2375 # required; no default
      ALLOWED_ORIGIN: https://dashboard.example.com # required; no default
      AUTHELIA_LOGOUT_URL: https://auth.example.com/logout # required; no default
      PORT: "3000" # default: 3000
      LOG_LEVEL: info # default: info
    volumes:
      - ./config/dashboard.yaml:/config/dashboard.yaml:ro
      - ./config/vapid.json:/config/vapid.json:ro
      - dashboard-data:/data

networks:
  homelab:
    external: true

volumes:
  dashboard-data:
```

Both services must use `container_name` values that match the Caddyfile fragment (`dashboard-client`, `dashboard-api`).

## First-run walkthrough

From an empty directory on a host where the prerequisites above are already in place:

### 1. Obtain the project

Clone or copy the dashboard repository into a working directory, for example `/opt/dashboard`.

### 2. Create the config directory

```sh
mkdir -p config
```

### 3. Write `config/dashboard.yaml`

Start from the example below. Every group in `applications` or `services` must also appear in the top-level `groups` list. Set `container_name` in each monitored application's compose file to match the names in `containers`.

```yaml
adminGroup: system-admins
groups:
  - app-users
  - app-admins
applications:
  - id: example-app
    name: Example App
    description: An example application entry.
    url: https://app.example.com
    icon: media.svg
    groups: [app-users]
    services:
      - id: web
        name: Web
        containers: [example-app-web]
      - id: db
        name: Database
        containers: [example-app-db]
        groups: [app-admins]
```

Icons are resolved against `/icons/` in the client bundle. Use a filename that exists in the build output (for example `media.svg` from the example config).

### 4. Generate and mount VAPID keys

Generate a key pair with a Web Push tool (for example `npx web-push generate-vapid-keys`). Create `config/vapid.json`:

```json
{
  "publicKey": "<your-public-key>",
  "privateKey": "<your-private-key>"
}
```

The private key stays in this file on disk only. It is never published in documentation or returned by the API. Copy [`config/vapid.json.example`](../config/vapid.json.example) as a starting point and replace both keys before production use.

### 5. Confirm the Docker network

The example compose joins an external network. It must already exist:

```sh
docker network inspect homelab
```

Create or rename the network in `docker-compose.example.yml` to match your stack.

### 6. Set required environment variables

Edit `docker-compose.example.yml` (or your own compose file) so these match your deployment:

| Variable | Example value |
| -------- | ------------- |
| `VAPID_SUBJECT` | `mailto:admin@example.com` |
| `DOCKER_PROXY_URL` | `http://socket-proxy:2375` |
| `ALLOWED_ORIGIN` | `https://dashboard.example.com` |
| `AUTHELIA_LOGOUT_URL` | `https://auth.example.com/logout` |

See [Environment variables](./environment-variables.md) for defaults and misconfiguration symptoms.

### 7. Build and start the containers

```sh
docker compose -f docker-compose.example.yml build
docker compose -f docker-compose.example.yml up -d
```

On first start the API validates config, loads VAPID keys, runs SQLite migrations on the `dashboard-data` volume, and listens on port 3000 inside the container. A config or VAPID error logs the issue and exits non-zero; the container restarts until fixed.

### 8. Apply the Caddyfile fragment

Merge [`deploy/Caddyfile.fragment`](../deploy/Caddyfile.fragment) into the Caddy site block for `https://dashboard.example.com` (your real hostname). Reload Caddy.

### 9. Verify routing

| Check | Expected result |
| ----- | ----------------- |
| `GET https://dashboard.example.com/` | Static client HTML without authentication |
| `GET https://dashboard.example.com/api/session` (browser, logged in) | JSON session with `name`, `email`, `admin`, `logoutUrl` |
| `GET https://dashboard.example.com/api/session` with a spoofed `Remote-User` header | Request still requires Authelia; spoofed header stripped before forward auth |

### 10. Confirm the dashboard

Open `https://dashboard.example.com` in a browser after authenticating through Authelia. You should see applications your groups entitle you to, with status badges when `containers` names match running containers on the daemon.

To apply a config change, edit `config/dashboard.yaml` and restart `dashboard-api`:

```sh
docker compose -f docker-compose.example.yml restart dashboard-api
```

## Startup behaviour

- Config is read once at startup; invalid YAML or schema violations exit non-zero.
- SQLite migrations run before the listener binds; an empty data volume becomes a working database automatically.
- The client image serves the built bundle and returns the application shell for unknown paths so deep links resolve.

## Keeping docs in sync with the schema

Run the drift check before review when you change config keys or environment variables:

```sh
pnpm check:docs
```

This compares [Configuration reference](./config-reference.md) and [Environment variables](./environment-variables.md) against the Zod schema and `readEnv()` respectively.
