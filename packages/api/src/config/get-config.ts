import type { ResolvedDashboardConfig } from './load-config.js';
import { freezeConfig, loadConfig, logConfigError } from './load-config.js';

let cachedConfig: ResolvedDashboardConfig | null = null;

export function initConfig(configPath?: string): ResolvedDashboardConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    cachedConfig = freezeConfig(loadConfig(configPath));
    return cachedConfig;
  } catch (error) {
    logConfigError(error);
    process.exit(1);
    throw error;
  }
}

export function getConfig(): ResolvedDashboardConfig {
  if (!cachedConfig) {
    throw new Error('Config has not been initialized. Call initConfig() at startup.');
  }

  return cachedConfig;
}

/** @internal */
export function resetConfigForTesting(): void {
  cachedConfig = null;
}
