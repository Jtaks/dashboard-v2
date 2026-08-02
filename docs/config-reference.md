# Configuration reference

YAML file mounted at `CONFIG_PATH` (default `/config/dashboard.yaml`). Validated once at API startup with the Zod schema in `packages/shared/src/config/schema.ts`.

Every key below must appear in this document. `pnpm check:docs` fails when the schema and this file disagree.

## Top-level keys

| Key | Type | Required | Default | Wrong value behaviour |
| --- | ---- | -------- | ------- | --------------------- |
| `adminGroup` | string | no | `system-admins` | Invalid type fails validation at startup; process exits non-zero |
| `groups` | array of strings | yes | — | Missing or non-array fails validation; empty array is valid |
| `applications` | array of application objects | yes | — | Missing or non-array fails validation; each entry must satisfy the application schema |

## Application keys (`applications[]`)

| Key | Type | Required | Default | Wrong value behaviour |
| --- | ---- | -------- | ------- | --------------------- |
| `id` | string | yes | — | Missing or empty fails validation |
| `name` | string | yes | — | Missing fails validation |
| `description` | string | yes | — | Missing fails validation |
| `url` | string (URL) | yes | — | Non-URL string fails validation |
| `icon` | string | yes | — | Missing fails validation; filename resolved against `/icons/` in the client bundle |
| `groups` | array of strings | yes | — | Missing fails validation; each group must appear in top-level `groups` |
| `requestable` | boolean | no | `false` | Invalid type fails validation; carried for a future access-request story, unused today |
| `services` | array of service objects | yes | — | Missing or invalid entries fail validation |

## Service keys (`applications[].services[]`)

| Key | Type | Required | Default | Wrong value behaviour |
| --- | ---- | -------- | ------- | --------------------- |
| `id` | string | yes | — | Missing fails validation |
| `name` | string | yes | — | Missing fails validation |
| `containers` | array of strings | yes | — | Missing fails validation; empty array is valid (link with no status); names must be literal `container_name` values; unknown name → status `down` and a warning log |
| `groups` | array of strings | no | application's `groups` | Each group must appear in top-level `groups`; service hidden when user matches none |

## Visibility and groups

- Application visible when **any** of its `groups` appears in `Remote-Groups`, or the user is in `adminGroup`.
- Service `groups` omitted → inherits application `groups`.
- Service with its own `groups` → visible only when the user matches **any** of those groups (OR).
- A service the user does not match is absent from catalog and status for that user.

## Validation summary

| Condition | Behaviour |
| --------- | --------- |
| File missing or unreadable | Error logged; exit non-zero |
| Invalid YAML | Error logged; exit non-zero |
| Schema violation (type, required field, URL format) | Error logged with path; exit non-zero |
| Group referenced but not in top-level `groups` | Error logged with path; exit non-zero |
| Unrecognised key at any level | Warning `Unrecognized config key "…" ignored`; startup continues |
| Config edit after startup | No effect until `dashboard-api` is restarted |

## Example

```yaml
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

All hostnames and group names above are examples only.
