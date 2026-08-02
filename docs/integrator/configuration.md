# Configuration reference

One YAML file, mounted into the API, read once and validated once at startup. The source of truth for accepted keys is the zod schema in `@dashboard/shared` (`configSchema`). A Vitest check fails when the schema gains a key that is missing from the documented-keys block below.

## Documented schema keys

```documented-schema-keys
adminGroup
groups
applications
applications.id
applications.name
applications.description
applications.url
applications.icon
applications.groups
applications.requestable
applications.services
applications.services.id
applications.services.name
applications.services.containers
applications.services.groups
```

## Root

| Key | Type | Required | Default | When wrong |
| --- | ---- | -------- | ------- | ---------- |
| `adminGroup` | string | no | `system-admins` | Wrong type → startup exits non-zero with a zod path/message. A name that matches no Authelia group simply means nobody is treated as admin. |
| `groups` | string[] | yes | — | Missing/wrong type → exit non-zero. This list is the topic vocabulary; see [Surprising rules](./README.md#surprising-rules-read-these-first). |
| `applications` | object[] | yes | — | Missing/wrong type → exit non-zero. An empty array starts but shows no catalog. |

## `applications[]`

| Key | Type | Required | Default | When wrong |
| --- | ---- | -------- | ------- | ---------- |
| `id` | string | yes | — | Missing/wrong type → exit non-zero. Stable key used in URLs. |
| `name` | string | yes | — | Missing/wrong type → exit non-zero. |
| `description` | string | yes | — | Missing/wrong type → exit non-zero. |
| `url` | string | yes | — | Missing/wrong type → exit non-zero. Example value: `https://media.example.com`. |
| `icon` | string | yes | — | Missing/wrong type → exit non-zero. Resolved against `/icons/` in the client bundle (example: `media.svg`). |
| `groups` | string[] | yes | — | Missing/wrong type → exit non-zero. A group not present in top-level `groups` → exit non-zero naming the application. Visibility is OR against `Remote-Groups`. |
| `requestable` | boolean | no | `false` | Wrong type → exit non-zero. Carried for a deferred story; unused by current UI. |
| `services` | object[] | yes | — | Missing/wrong type → exit non-zero. Empty array is legal (link with no status rows). |

## `applications[].services[]`

| Key | Type | Required | Default | When wrong |
| --- | ---- | -------- | ------- | ---------- |
| `id` | string | yes | — | Missing/wrong type → exit non-zero. |
| `name` | string | yes | — | Missing/wrong type → exit non-zero. |
| `containers` | string[] | yes | — | Missing/wrong type → exit non-zero. Empty array is legal (link, status `null`). Entries are **literal** docker container names — set `container_name` in the target compose. A name that matches nothing is reported **down** and logged as a warning. |
| `groups` | string[] | no | inherits the application's `groups` | Wrong type → exit non-zero. A group not in top-level `groups` → exit non-zero naming the service. When set, narrows visibility (OR). A service the user does not match is absent from their view and from status aggregated for them. |

## Validation behaviour (all keys)

- **Missing or malformed required values:** logged as `config: <path>: <message>`; process exits non-zero before the HTTP listener binds. No partial config is retained.
- **Unrecognised keys:** logged as a warning and ignored (newer file against older image degrades rather than breaks).
- **Unparseable YAML or unreadable file:** exit non-zero.
- **No reload:** restart the API after edits.

## Example catalog (marked example)

```yaml
# Example only — replace group names, URLs, and container names for your deployment.
adminGroup: system-admins
groups:
  - media-users
  - media-admins
applications:
  - id: media
    name: Media
    description: Films and series.
    url: https://media.example.com
    icon: media.svg
    groups: [media-users]
    requestable: false
    services:
      - id: jellyfin
        name: Jellyfin
        containers: [jellyfin]
      - id: db
        name: Database
        containers: [jellyfin-db]
        groups: [media-admins]
```

A copy suitable for local bring-up lives at [`deploy/config/dashboard.yaml`](../../deploy/config/dashboard.yaml).
