# First-run walkthrough

Empty directory mindset → a dashboard that lists applications with status. Follow the steps in order; do not improvise values that these docs leave as examples without replacing them for your host.

## Verification status

**This cloud/agent environment cannot stand up a real Caddy + Authelia + LLDAP + socket-proxy stack.** The walkthrough below is complete as written. Live verification against a real edge stack is **integrator-executed** on a host that already has the [prerequisites](./prerequisites.md).

Record the outcome when you run it:

| Field | Value |
| ----- | ----- |
| Executed by | _(integrator)_ |
| Host / date | _(fill in)_ |
| Result | _(working dashboard with catalog + status / failure notes)_ |

## Steps

1. **Confirm prerequisites** — Caddy ingress for one origin, Authelia asserting groups, LLDAP holding the groups you will name, a read-only socket proxy, and a VAPID key pair you generated yourself. See [Prerequisites](./prerequisites.md).

2. **Clone or copy the project** into a working directory and ensure Docker can build from the repo root.

3. **Ensure the external docker network exists** — the example compose joins a network named `proxy`. Create it (or change `networks.proxy.name` in `deploy/compose.example.yaml` to your existing edge network name).

4. **Edit the catalog** — start from `deploy/config/dashboard.yaml`. Set `groups`, applications, and `containers` to names that exist in LLDAP and on the Engine (literal `container_name` values). All sample hostnames and groups are examples.

5. **Install VAPID keys** — replace `deploy/config/vapid.json` with your integrator-generated `{ "publicKey", "privateKey" }`. Do not paste the private key into tickets or docs. Set `VAPID_SUBJECT` in compose to a real `mailto:` or `https:` contact.

6. **Set required compose environment** (no TDD defaults):
   - `ALLOWED_ORIGIN` — the browser origin Caddy serves (example shape: `https://dashboard.example.com`)
   - `AUTHELIA_LOGOUT_URL` — Authelia logout URL returned to the client
   - `DOCKER_PROXY_URL` — base URL of the socket proxy (example shape: `http://socket-proxy:2375`)
   - `VAPID_SUBJECT` — as above

7. **Apply the Caddyfile fragment** — merge [`deploy/Caddyfile.fragment`](../../deploy/Caddyfile.fragment) into the Caddy site for that origin so `/api` is authenticated, other paths are open, and inbound `Remote-*` are stripped ([Packaging](./packaging.md)).

8. **Start the stack** from the repo root:

   ```bash
   docker compose -f deploy/compose.example.yaml up --build
   ```

9. **Confirm API boot** — if config, VAPID keys, or required env are wrong, the API exits non-zero with a logged error before binding. Fix and restart (there is no reload).

10. **Sign in through Authelia** at the dashboard origin and open the UI.

11. **Expect a working dashboard** — applications you are entitled to see appear; services with matching containers show status (not permanently unknown unless the proxy is unset/unreachable). Admin-only services stay hidden unless your groups include them or `adminGroup`.

## If status is wrong

- **All unknown** — `DOCKER_PROXY_URL` unset or proxy unreachable.
- **Named service down forever** — catalog `containers` entry does not match a `container_name` on the Engine.
- **Empty catalog** — your Authelia groups do not OR-match any application `groups`, or the YAML failed to load (check API logs).
