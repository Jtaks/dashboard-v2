<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { page } from '$app/state';
</script>

<main data-testid="detail-placeholder">
  <h1>{m.placeholder_detail()}</h1>
  <p data-testid="application-id">{page.params.id}</p>
</main>
