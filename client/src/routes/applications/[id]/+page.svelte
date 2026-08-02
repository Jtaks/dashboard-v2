<script lang="ts">
  import { page } from '$app/state';
  import { createQuery } from '@tanstack/svelte-query';
  import { ForbiddenError, UnauthorizedError } from '$lib/api/client.js';
  import { findApplicationById } from '$lib/catalog/lookup.js';
  import { catalogQueryOptions } from '$lib/catalog/query.js';
  import Forbidden from '$lib/components/Forbidden.svelte';
  import SignedOut from '$lib/components/SignedOut.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getApplicationStatus, getServiceStatus } from '$lib/status/accessors.js';
  import { formatSinceDuration } from '$lib/status/duration.js';
  import { readStatusQueryState, statusQueryOptions } from '$lib/status/query.js';

  const catalogQuery = createQuery(() => catalogQueryOptions());
  // C3 shared status poll — same key as the shell/catalog; never fetched ad hoc here.
  const statusQuery = createQuery(() => statusQueryOptions());

  const applicationId = $derived(page.params.id ?? '');
  const application = $derived(findApplicationById(catalogQuery.data, applicationId));

  const statusState = $derived(readStatusQueryState(statusQuery));
  const applicationStatus = $derived(getApplicationStatus(statusState.report, applicationId));
  // Recompute durations when each poll lands (dataUpdatedAt), not once at first paint.
  const nowMs = $derived(statusQuery.dataUpdatedAt);

  const applicationUptime = $derived(
    applicationStatus && nowMs ? formatSinceDuration(applicationStatus.since, nowMs) : null,
  );

  const serviceRows = $derived(
    (application?.services ?? []).map((service) => {
      const reading = getServiceStatus(statusState.report, applicationId, service.id);
      const showStatus = service.hasContainers;
      const uptime =
        showStatus && nowMs ? formatSinceDuration(reading?.since ?? null, nowMs) : null;
      return {
        id: service.id,
        name: service.name,
        hasContainers: service.hasContainers,
        status: showStatus ? (reading?.status ?? null) : null,
        uptime,
      };
    }),
  );

  const unauthorized = $derived(
    catalogQuery.error instanceof UnauthorizedError ? catalogQuery.error : null,
  );
  const forbidden = $derived(
    catalogQuery.error instanceof ForbiddenError ? catalogQuery.error : null,
  );
</script>

{#if unauthorized}
  <SignedOut location={unauthorized.location} />
{:else if forbidden}
  <Forbidden code={forbidden.code} />
{:else if catalogQuery.isPending}
  <div data-testid="detail-loading" role="status">{m.catalog_loading()}</div>
{:else if catalogQuery.isError}
  <section data-testid="detail-error" aria-labelledby="detail-error-title">
    <h1 id="detail-error-title">{m.catalog_error_title()}</h1>
    <p>{m.catalog_error_body()}</p>
    <button type="button" data-testid="detail-retry" onclick={() => catalogQuery.refetch()}>
      {m.catalog_retry()}
    </button>
  </section>
{:else if !application}
  <section data-testid="detail-not-found" aria-labelledby="detail-not-found-title">
    <h1 id="detail-not-found-title">{m.detail_not_found_title()}</h1>
    <p>{m.detail_not_found_body()}</p>
  </section>
{:else}
  <article data-testid="application-detail" data-app-id={application.id}>
    <header class="detail-header">
      <h1 data-testid="application-name">{application.name}</h1>
      <p data-testid="application-description">{application.description}</p>
      <!-- Application URLs are absolute external targets — never compiled into the client. -->
      <!-- prettier-ignore -->
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
      <a href={application.url} data-testid="application-open-link" data-sveltekit-reload>
        {m.detail_open()}
      </a>
      <div class="header-status" data-testid="application-header-status">
        <StatusBadge status={applicationStatus?.status ?? null} />
        {#if applicationUptime}
          <span data-testid="application-uptime">{applicationUptime}</span>
        {/if}
      </div>
    </header>

    <section data-testid="application-status-detail" aria-label={m.detail_status_label()}>
      {#if serviceRows.length > 0}
        <h2 class="services-heading" id="detail-services-heading">{m.detail_services_label()}</h2>
        <ul
          class="service-list"
          data-testid="service-status-list"
          role="listbox"
          aria-labelledby="detail-services-heading"
        >
          {#each serviceRows as service (service.id)}
            <li
              class="service-row"
              data-testid="service-status-row"
              data-service-id={service.id}
              data-has-containers={service.hasContainers ? 'true' : 'false'}
              role="option"
              aria-selected="false"
              tabindex="0"
            >
              <span class="service-name">{service.name}</span>
              {#if service.hasContainers}
                <span class="service-status">
                  <StatusBadge status={service.status} />
                  {#if service.uptime}
                    <span data-testid="service-uptime">{service.uptime}</span>
                  {/if}
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </article>
{/if}

<style>
  .detail-header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .detail-header h1,
  .detail-header p {
    margin: 0;
  }

  .header-status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .services-heading {
    margin: 0 0 0.75rem;
    font-size: 1rem;
  }

  .service-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .service-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.35rem 0.15rem;
  }

  .service-row:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  .service-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .service-status {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
    flex-shrink: 0;
  }
</style>
