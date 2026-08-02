/** Config key vocabulary — kept in sync with `unknown-keys.ts` and integrator docs. */
export const TOP_LEVEL_CONFIG_KEYS = ['adminGroup', 'groups', 'applications'] as const;

export const APPLICATION_CONFIG_KEYS = [
  'id',
  'name',
  'description',
  'url',
  'icon',
  'groups',
  'requestable',
  'services',
] as const;

export const SERVICE_CONFIG_KEYS = ['id', 'name', 'containers', 'groups'] as const;

export type TopLevelConfigKey = (typeof TOP_LEVEL_CONFIG_KEYS)[number];
export type ApplicationConfigKey = (typeof APPLICATION_CONFIG_KEYS)[number];
export type ServiceConfigKey = (typeof SERVICE_CONFIG_KEYS)[number];
