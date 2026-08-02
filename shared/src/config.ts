import { z } from 'zod';

/** Service entry in the dashboard config file. */
export const serviceConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  containers: z.array(z.string()),
  groups: z.array(z.string()).optional(),
});

/** Application entry in the dashboard config file. */
export const applicationConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  url: z.string(),
  icon: z.string(),
  groups: z.array(z.string()),
  requestable: z.boolean().default(false),
  services: z.array(serviceConfigSchema),
});

/**
 * Dashboard YAML config schema. Source of truth for config types;
 * A3 validates the mounted file against this definition.
 */
export const configSchema = z.object({
  adminGroup: z.string().default('system-admins'),
  groups: z.array(z.string()),
  applications: z.array(applicationConfigSchema),
});

export type ServiceConfig = z.infer<typeof serviceConfigSchema>;
export type ApplicationConfig = z.infer<typeof applicationConfigSchema>;
export type Config = z.infer<typeof configSchema>;
