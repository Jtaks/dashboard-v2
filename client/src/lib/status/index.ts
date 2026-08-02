/** C4 status presentation helpers. StatusBadge lives at `$lib/components/StatusBadge.svelte`. */
export { countServicesByStatus, emptyStatusCounts, statusCountEntries } from './counts.js';
export type { StatusCounts } from './counts.js';
export { statusAccessibleName, statusKeyLabel, statusNullLabel } from './labels.js';
export { getApplicationStatus, getServiceStatus } from './accessors.js';
export {
  fetchStatus,
  readStatusQueryState,
  STATUS_REFETCH_INTERVAL_MS,
  statusQueryKey,
  statusQueryOptions,
} from './query.js';
