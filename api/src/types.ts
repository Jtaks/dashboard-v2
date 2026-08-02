import type { Identity } from './identity.js';

/** Hono Variables set by the identity middleware. */
export type AppVariables = {
  identity: Identity;
};
