# PWA: iOS home-screen path and shell cache updates

## iOS home-screen verification (hand only)

iOS delivers Web Push only to a home-screen PWA. Playwright cannot drive Safari's share sheet, so this path is verified on a physical device and recorded here.

### Checklist

1. Open the dashboard origin in **Safari** (not an in-app browser).
2. Share → **Add to Home Screen**; confirm the name and icon.
3. Launch from the home-screen icon (standalone, not a Safari tab).
4. Confirm the service worker registers (`navigator.serviceWorker.ready` in the Web Inspector console).
5. On Settings → Notifications, subscribe; confirm a push subscription exists.
6. In an ordinary Safari tab (not the installed PWA) on the same device, confirm Settings still shows the home-screen requirement and subscribe is not available the same way.

### Result placeholder

| Field                | Value                    |
| -------------------- | ------------------------ |
| Date                 | _TBD_                    |
| iOS version          | _TBD_                    |
| Device               | _TBD_                    |
| Build / image        | _TBD_                    |
| Standalone opens     | _pass / fail_            |
| SW registered        | _pass / fail_            |
| Push subscribe (PWA) | _pass / fail_            |
| Tab cannot subscribe | _pass / fail_ (expected) |
| Notes                |                          |

## Service worker cache updates after rebuild

The client service worker (`client/src/service-worker.ts`) already version-keys the shell cache as `dashboard-shell-${version}`, where `version` comes from SvelteKit's `$service-worker` module and changes every production build.

On install it calls `skipWaiting()`. On activate it deletes every cache whose name is not the current `CACHE`, then `clients.claim()`.

So after a rebuild is deployed:

1. The browser fetches the new worker script.
2. The new worker installs, precaches the new shell, and skips waiting.
3. Activation removes the previous `dashboard-shell-*` cache.
4. The next navigation is served from the new shell rather than a shadowed old one.

`/api` is never written to Cache Storage; offline API traffic fails at the network, which is intentional.
