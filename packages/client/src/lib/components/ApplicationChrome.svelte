<script lang="ts">
  import { resolve } from '$app/paths';
  import { Cog } from '@lucide/svelte';

  import InstallAppButton from '$lib/components/InstallAppButton.svelte';
  import * as m from '$lib/paraglide/messages';
</script>

<header class="app-chrome">
  <a
    class="app-chrome__home"
    id="alert-dismiss-focus-target"
    href={resolve('/')}
  >{m.app_title()}</a>
  <div class="app-chrome__actions">
    <InstallAppButton />
    <a
      class="app-chrome__settings"
      href={resolve('/settings')}
      aria-label={m.chrome_settings_link()}
    >
      <Cog aria-hidden="true" size={20} strokeWidth={2} />
    </a>
  </div>
</header>

<style>
  .app-chrome {
    align-items: center;
    box-sizing: border-box;
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    margin: 0 0 1rem;
    max-width: 100%;
    padding: 0.75rem 0;
    width: 100%;
  }

  .app-chrome__home {
    color: inherit;
    font-size: 1.125rem;
    font-weight: 600;
    text-decoration: none;
  }

  .app-chrome__home:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  .app-chrome__actions {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 0.5rem;
  }

  .app-chrome__settings {
    align-items: center;
    border: 1px solid #ccc;
    border-radius: 0.375rem;
    color: inherit;
    display: inline-flex;
    flex-shrink: 0;
    justify-content: center;
    min-height: 2.5rem;
    min-width: 2.5rem;
    text-decoration: none;
  }

  .app-chrome__settings:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }
</style>
