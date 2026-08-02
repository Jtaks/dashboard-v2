<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';

  let { code = null }: { code?: string | null } = $props();
</script>

<section data-testid="forbidden" aria-labelledby="forbidden-title">
  <h1 id="forbidden-title">{m.forbidden_title()}</h1>
  <p>{m.forbidden_body()}</p>
  {#if code}
    <p data-testid="forbidden-code">{code}</p>
  {/if}
</section>
