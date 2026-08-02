import type { ApplicationStatus, ServiceStatus } from '@dashboard/shared';

import { findApplicationStatus, findServiceStatus } from './lookup.js';
import { useStatusQuery } from './query.js';

export type StatusAccessorState<TStatus> = {
  readonly status: TStatus | null;
  readonly loading: boolean;
  readonly error: unknown;
  readonly collectedAt: string | null;
  readonly isRefreshError: boolean;
};

function createAccessorState<TStatus>(
  readStatus: () => TStatus | null,
  statusQuery: ReturnType<typeof useStatusQuery>,
): StatusAccessorState<TStatus> {
  return {
    get status() {
      return readStatus();
    },
    get loading() {
      return statusQuery.isPending && statusQuery.data === undefined;
    },
    get error() {
      return statusQuery.error ?? null;
    },
    get collectedAt() {
      return statusQuery.data?.collectedAt ?? null;
    },
    get isRefreshError() {
      return statusQuery.isError && statusQuery.data !== undefined;
    },
  };
}

export function useApplicationStatus(applicationId: string): StatusAccessorState<ApplicationStatus> {
  const statusQuery = useStatusQuery();

  return createAccessorState(
    () =>
      statusQuery.data ? findApplicationStatus(statusQuery.data, applicationId) : null,
    statusQuery,
  );
}

export function useServiceStatus(
  applicationId: string,
  serviceId: string,
): StatusAccessorState<ServiceStatus> {
  const statusQuery = useStatusQuery();

  return createAccessorState(
    () =>
      statusQuery.data !== undefined
        ? findServiceStatus(statusQuery.data, applicationId, serviceId)
        : null,
    statusQuery,
  );
}
