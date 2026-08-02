<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  let { signInUrl }: { signInUrl: string } = $props();
</script>

<section class="auth-panel" aria-labelledby="sign-in-title">
  <h1 id="sign-in-title">{m.auth_sign_in_title()}</h1>
  <p>{m.auth_sign_in_message()}</p>
  <a id="sign-in-link" href={signInUrl}>{m.auth_sign_in_link()}</a>
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
