# Icons

Two icon sources serve different purposes. Do not mix them.

## Application catalog icons

Per-application artwork lives in `static/icons/` and ships inside the client bundle. Each application's `icon` value in the deployment configuration resolves against `/icons/` at runtime (see `src/lib/catalog/icon.ts`).

- Add one asset per application, named to match the config `icon` field (for example `media.svg`).
- Normalise the set: SVG, 24×24 square `viewBox`, transparent background, and consistent padding so icons read as one family at row and tile size.
- `placeholder.svg` is used when an asset is missing or fails to load.

## Interface icons

UI chrome (navigation, controls, status affordances, and similar product UI) uses [Lucide](https://lucide.dev/) via the `@lucide/svelte` package. Import icons from `@lucide/svelte` only; do not add a second interface icon library or inline one-off SVGs for controls.

```svelte
<script lang="ts">
  import { Search } from '@lucide/svelte';
</script>

<Search aria-hidden="true" size={20} />
```
