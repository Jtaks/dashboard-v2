# Visual accessibility audit (G3)

Audit date: 2026-08-01  
Build: `@dashboard/client@0.0.0`, SvelteKit client version `1785619071139` (production build from this audit)  
Auditor: automated scripts + manual review of status/severity presentation

This note records the non-test-enforced accessibility bar from [TDD — Testing](https://github.com/): contrast, mobile zoom/reflow, and `prefers-reduced-motion`. Repeat this audit when colour tokens or layout change.

## Method

| Check | Tool |
| --- | --- |
| Contrast ratios | `packages/client/scripts/measure-contrast.mjs` (WCAG relative luminance formula) |
| Viewport reflow | `packages/client/scripts/viewport-audit.mjs` (Playwright + Chromium CDP `setPageScaleFactor`) |
| Pinch zoom | Viewport meta inspection in `src/app.html` |
| Reduced motion | Global rule in `src/lib/styles/global.css`; no component-level transitions present |
| Colour-alone | Component review: `StatusBadge.svelte`, `AlertsBanner.svelte`, null-status behaviour |

WCAG AA thresholds applied:

- Normal text (&lt; 18pt / &lt; 14pt bold): **4.5:1**
- Large text and non-text UI (borders): **3:1**

Page surface for text-form tokens: `#ffffff` (`--surface-page`).

## Remediation summary

Status and severity colours were centralised in `packages/client/src/lib/styles/tokens.css`. Components reference tokens via CSS custom properties so a single definition applies everywhere.

**Pre-audit failures (remediated via tokens):**

| Token | Issue | Change |
| --- | --- | --- |
| `--status-degraded-badge-fg` | 3.46:1 on badge background (was `#e65100`) | Darkened to `#c43e00` (4.74:1) |
| `--status-*-badge-border` (all) | Borders below 3:1 on tinted backgrounds | Darkened per status (see table below) |
| `--severity-warning-banner-border` | 2.47:1 on banner background (was `#f57c00`) | Aligned with warning text token `#c43e00` (4.74:1) |

No deliberate exceptions remain below AA after remediation.

## Status contrast (post-remediation)

| Status | Badge fg on bg | Badge border on bg | Text on page |
| --- | --- | --- | --- |
| `up` | 7.00:1 ✓ | 3.66:1 ✓ | 7.87:1 ✓ |
| `starting` | 7.56:1 ✓ | 4.03:1 ✓ | 8.63:1 ✓ |
| `degraded` | 4.74:1 ✓ | 4.74:1 ✓ | 5.20:1 ✓ |
| `down` | 5.75:1 ✓ | 4.36:1 ✓ | 6.57:1 ✓ |
| `unknown` | 9.22:1 ✓ | 4.23:1 ✓ | 10.05:1 ✓ |

**Badge presentation:** `StatusBadge` — icon (Lucide shape) + visible capitalised label + `aria-label` from message catalog.  
**Text presentation:** `--status-*-text` tokens defined for on-surface use (admin and future call sites).

## Severity contrast (post-remediation)

| Severity | Banner fg on bg | Banner border on bg | Text on page |
| --- | --- | --- | --- |
| `info` | 15.24:1 ✓ | 5.03:1 ✓ | 5.75:1 ✓ |
| `success` | 15.47:1 ✓ | 4.56:1 ✓ | 5.13:1 ✓ |
| `warning` | 15.87:1 ✓ | 4.74:1 ✓ | 5.20:1 ✓ |
| `error` | 15.22:1 ✓ | 4.92:1 ✓ | 5.62:1 ✓ |

**Banner presentation:** `AlertsBanner` — uppercase severity label + title + optional body; dismiss control with visible text.  
**Text presentation:** `AdminAlertsSection` severity column uses `--severity-*-text` with bold weight.

## Not colour-alone

| Value | Non-colour cues |
| --- | --- |
| `up` | CircleCheck icon, label "Up" |
| `starting` | CircleDashed icon, label "Starting" |
| `degraded` | AlertTriangle icon, label "Degraded" |
| `down` | CircleX icon, label "Down" |
| `unknown` | CircleHelp icon, label "Unknown" |
| `null` (absent status) | No badge rendered; application with all-null services shows no status badge (see `status-presentation.spec.ts`) |
| `info` / `success` / `warning` / `error` | Text severity label on every banner; coloured text label in admin table |

## Mobile zoom and reflow

**Viewport meta** (`src/app.html`): `width=device-width, initial-scale=1` — does not set `maximum-scale` or `user-scalable=no`; pinch zoom is permitted.

**Reflow** (no horizontal overflow; `scrollWidth ≤ clientWidth`):

| Route | 320px viewport | 200% page scale @ 320px |
| --- | --- | --- |
| List (`/`) | Pass | Pass |
| Grid (`/`, grid toggle) | Pass | Pass |
| Detail (`/apps/media`) | Pass | Pass |
| Settings (`/settings`) | Pass | Pass |
| Admin (`/admin`) | Pass | Pass |

Admin alerts table stacks to a single column below 40rem; catalog grid collapses to one column below 30rem. `AuthShell` uses `overflow-x: clip` and `max-width: 100%` to contain children.

Pinch zoom on a physical mobile browser was not re-tested in this run; meta tag configuration matches the requirement.

## Reduced motion

`prefers-reduced-motion: reduce` in `global.css` sets `animation-duration`, `transition-duration`, and `scroll-behavior` to effectively instant/auto for all elements.

The codebase has no component-level `transition` or `animation` rules at audit time, so state changes (banner mount, expander open/close, status badge updates) are already instantaneous. Expander content appears/disappears without motion; expanded state is exposed via `aria-expanded`.

## Deliberate exceptions

None.

## PWA install (G4)

Audit date: 2026-08-01  
Build: `@dashboard/client@0.0.0` (production build from this audit)

| Check | Result |
| --- | --- |
| Manifest linked and origin-agnostic | Pass — `manifest.webmanifest` uses relative `start_url`, `scope`, and icon paths |
| Required install icons + maskable variants | Pass — 192 and 512 PNGs under `/pwa/`, separate from per-application `/icons/` |
| Apple touch icon | Pass — `/pwa/apple-touch-icon.png` linked in document head |
| Desktop/Android install affordance | Pass — button appears only after `beforeinstallprompt` (Playwright) |
| Cached shell offline | Pass — visited route renders shell with network disabled (Playwright) |
| `/api` not cached | Pass — offline `fetch('/api/session')` fails (Playwright) |
| iOS home-screen install + push | **Not automated** — verify manually on device: add to home screen from Safari share menu, confirm standalone launch, service worker registration, and push subscription. Record iOS version and outcome here when tested. |
