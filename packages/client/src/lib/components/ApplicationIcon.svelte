<script lang="ts">
  import type { Application } from '@dashboard/shared';

  import { resolveIconSrc } from '$lib/catalog/icon.js';
  import * as m from '$lib/paraglide/messages';

  let { application }: { application: Application } = $props();

  let usePlaceholder = $state(false);

  const iconSrc = $derived(resolveIconSrc(application.icon, usePlaceholder));

  function handleImageError() {
    if (!usePlaceholder) {
      usePlaceholder = true;
    }
  }
</script>

<a
  class="application-icon"
  href={application.url}
  aria-label={m.catalog_open_app({ name: application.name })}
>
  <img
    src={iconSrc}
    alt=""
    width="48"
    height="48"
    onerror={handleImageError}
    data-placeholder={usePlaceholder ? 'true' : 'false'}
  />
</a>

<style>
  .application-icon {
    display: inline-flex;
    flex-shrink: 0;
  }

  .application-icon img {
    display: block;
    border-radius: 0.5rem;
  }
</style>
