# Visual accessibility audit (G3)

Performed against the dashboard-v2 client on branch `grok-4.5`, covering the token centralization in `client/src/lib/styles/tokens.css` and the component wiring in `StatusBadge` / `AlertBanners`. Parent commit at audit time: `0aeedf50becd74f9b1c88b9b130e65c3dd3abf65`. Re-run when status/severity tokens or primary layout change.

Checker: WCAG 2.x relative-luminance contrast (`client/scripts/contrast-audit.mjs`). Surfaces assume light Canvas `#ffffff` (the app does not set a dark colour scheme).

AA threshold used: **4.5:1** for normal text (badge labels ~0.8rem / 600, banner body and titles).

## Status colour pairings

Foreground tokens live in `:root` as `--status-*`. Badge fill is `color-mix(in srgb, var(--status-*) var(--status-tint), transparent)` with `--status-tint: 12%` over Canvas.

| Status   | Foreground | Badge surface (12% tint) | Badge ratio | Text on Canvas | Result |
| -------- | ---------- | ------------------------ | ----------- | -------------- | ------ |
| up       | `#0f6b3a`  | `#e2ede7`                | 5.50:1      | 6.59:1         | AA     |
| starting | `#1a5f8a`  | `#e4ecf1`                | 5.76:1      | 6.89:1         | AA     |
| degraded | `#8a5a00`  | `#f1ebe0`                | 5.00:1      | 5.93:1         | AA     |
| down     | `#9b1c1c`  | `#f3e4e4`                | 6.61:1      | 8.15:1         | AA     |
| unknown  | `#4a5568`  | `#e9ebed`                | 6.30:1      | 7.53:1         | AA     |

Remediation: none required — existing hues already met AA; they were moved from component literals into shared tokens without changing values.

## Severity colour pairings

Foreground tokens: `--severity-*`. Banner fill uses `--severity-tint: 12%` except warning at `--severity-warning-tint: 14%`.

| Severity | Foreground | Banner surface  | Banner ratio | Text on Canvas | Result |
| -------- | ---------- | --------------- | ------------ | -------------- | ------ |
| info     | `#1a5f8a`  | `#e4ecf1` (12%) | 5.76:1       | 6.89:1         | AA     |
| success  | `#0f6b3a`  | `#e2ede7` (12%) | 5.50:1       | 6.59:1         | AA     |
| warning  | `#8a5a00`  | `#efe8db` (14%) | 4.86:1       | 5.93:1         | AA     |
| error    | `#9b1c1c`  | `#f3e4e4` (12%) | 6.61:1       | 8.15:1         | AA     |

Remediation: none required (values unchanged; centralized only).

## Colour alone

| Presentation              | Non-colour cue                                                                |
| ------------------------- | ----------------------------------------------------------------------------- |
| Status badge              | Distinct Lucide icon per status + visible text label from the message catalog |
| Absent status (`null`)    | Badge omitted (no colour-only empty state)                                    |
| Alert banner              | Uppercase severity label (`severityLabel`) plus title/body text               |
| Admin alert rows          | Severity shown as catalog text, not colour                                    |
| Dependency summary counts | Count + status name text; per-service rows reuse StatusBadge                  |

## Mobile zoom and reflow

Viewport meta (`client/src/app.html`): `width=device-width, initial-scale=1` — no `maximum-scale` / `user-scalable=no`, so pinch zoom is allowed by the meta tag.

Reflow probe (`client/scripts/reflow-probe.mjs` against production preview): `documentElement.scrollWidth` vs `clientWidth` with API stubs.

| Route    | 320 CSS px | 200% zoom (CSS `zoom` on 1280-wide viewport) |
| -------- | ---------- | -------------------------------------------- |
| list `/` | pass       | pass                                         |
| grid `/` | pass       | pass                                         |
| detail   | pass       | pass                                         |
| settings | pass       | pass                                         |
| admin    | pass       | pass                                         |

Pinch zoom on a real mobile browser was **not** exercised in this environment; meta inspection plus desktop reflow are the recorded evidence. Confirm on a phone when cutting a release if desired.

## Reduced motion

`tokens.css` applies under `@media (prefers-reduced-motion: reduce)` a global kill of animation/transition duration (0.01ms) and resets `scroll-behavior`.

Probe with Playwright `reducedMotion: 'reduce'` on `/settings`: `.flag-toggle-track` computed `transition-duration` / `animation-duration` both `0.01ms` (`1e-05s`). Banner and expander have no entrance/height transitions today; status changes are class swaps with no transition — all remain legible with motion disabled.

## Deliberately unremediated

- Dark / forced-colors themes: not shipped; audit assumes light Canvas only.
- Real-device pinch gesture: not available in the cloud/desktop probe (see above).
- Decorative badge/banner borders (low-alpha `currentColor` mixes): not treated as the status/severity text pairing under test.

## How to re-run

```bash
node client/scripts/contrast-audit.mjs
# with client preview on :4173
node client/scripts/reflow-probe.mjs
```
