/** Client-declared feature flag. Stored per browser; nothing about flags is server-side. */
export type FeatureFlag = { feature: string; description: string; admin: boolean };
