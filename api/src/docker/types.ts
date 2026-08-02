/** Normalized container reading used by status mapping and collection. */
export type ContainerSnapshot = {
  /** Literal container name without a leading slash. */
  name: string;
  /** Engine state string: running, exited, created, restarting, paused, dead, removing, … */
  state: string;
  /**
   * Healthcheck status when the image declares one: healthy | unhealthy | starting | none.
   * `null` when the daemon reports no health info (treated as no healthcheck).
   */
  health: string | null;
  /** Daemon start time for the current run (ISO 8601), or null when unknown/absent. */
  startedAt: string | null;
};

/** Raw list item fields we read from GET /containers/json. */
export type DockerListItem = {
  Id?: string;
  Names?: string[];
  State?: string;
  Status?: string;
  Health?: string | { Status?: string } | null;
  /** Non-standard / inspect-enriched; present when the client merged inspect data. */
  StartedAt?: string;
};
