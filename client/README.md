# Client

SvelteKit static shell. Application artwork lives under `static/icons/` and is
served at `/icons/…` from the client bundle — nothing is fetched from third-party
or application hosts at runtime. Missing catalog icons fall back to
`/icons/placeholder.svg`.

## Interface icons

**`@lucide/svelte` is the single source for product chrome icons** (nav, controls,
status affordances). Do not add another icon library for the interface; use Lucide
components from that package.
