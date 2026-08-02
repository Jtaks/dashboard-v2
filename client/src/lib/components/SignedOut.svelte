<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';

  let { location }: { location: string | null } = $props();
</script>

<section data-testid="signed-out" aria-labelledby="signed-out-title">
  <h1 id="signed-out-title">{m.signed_out_title()}</h1>
  <p>{m.signed_out_body()}</p>
  {#if location}
    <!-- Location comes from the 401 response; Authelia address is never in the bundle. -->
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a data-testid="sign-in" href={location} data-sveltekit-reload>{m.sign_in()}</a>
  {:else}
    <a data-testid="sign-in" href="#sign-in" aria-disabled="true">{m.sign_in()}</a>
  {/if}
</section>
