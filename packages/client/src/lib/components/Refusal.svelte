<script lang="ts">
  import * as m from '$lib/paraglide/messages';
</script>

<section class="auth-panel" aria-labelledby="refusal-title">
  <h1 id="refusal-title">{m.auth_refusal_title()}</h1>
  <p>{m.auth_refusal_message()}</p>
</section>

<style>
  .auth-panel {
    margin: 2rem auto;
    max-width: 32rem;
    padding: 1.5rem;
    border: 1px solid #ccc;
    border-radius: 0.5rem;
  }
</style>
