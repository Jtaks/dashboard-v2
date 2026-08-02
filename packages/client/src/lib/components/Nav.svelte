<script lang="ts">
  import type { Session } from '@dashboard/shared';
  import { resolve } from '$app/paths';

  import * as m from '$lib/paraglide/messages';

  let { session }: { session: Session } = $props();
</script>

<nav aria-label="Primary">
  <ul>
    <li><a href={resolve('/')}>{m.nav_home()}</a></li>
    {#if session.admin}
      <li><a href={resolve('/admin')}>{m.nav_admin()}</a></li>
    {/if}
    <li><a href={session.logoutUrl}>{m.nav_sign_out()}</a></li>
  </ul>
</nav>

<style>
  nav ul {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    list-style: none;
    margin: 0 0 1.5rem;
    padding: 0;
  }

  nav a:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }
</style>
