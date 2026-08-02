import type Database from 'better-sqlite3';

import {
  listAllEndpoints,
  listEndpointsByTopic,
  type PushSubscriptionRecord,
} from './repository.js';

/**
 * Resolve the push audience for a topic through the F1 selectors.
 * `*` → every subscription; a group topic → endpoints carrying that topic.
 * Distinct endpoints only (an endpoint matching multiple topics is still one row).
 */
export function resolvePushAudience(
  db: Database.Database,
  topic: string,
): PushSubscriptionRecord[] {
  if (topic === '*') {
    return listAllEndpoints(db);
  }
  return listEndpointsByTopic(db, topic);
}

/** Fixture row for pure audience expansion tests (no DB). */
export type AudienceFixture = {
  endpoint: string;
  topics: readonly string[];
};

/**
 * Expand a topic over a fixture vocabulary of endpoint→topics mappings.
 * De-duplicates endpoints that carry more than one matching topic.
 * A topic no subscription carries yields an empty list.
 */
export function expandAudience(
  subscriptions: readonly AudienceFixture[],
  topic: string,
): string[] {
  if (topic === '*') {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const sub of subscriptions) {
      if (!seen.has(sub.endpoint)) {
        seen.add(sub.endpoint);
        out.push(sub.endpoint);
      }
    }
    return out;
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const sub of subscriptions) {
    if (sub.topics.includes(topic) && !seen.has(sub.endpoint)) {
      seen.add(sub.endpoint);
      out.push(sub.endpoint);
    }
  }
  return out;
}
