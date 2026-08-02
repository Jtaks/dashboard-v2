import { z } from 'zod';

const serviceConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  containers: z.array(z.string()),
  groups: z.array(z.string()).optional(),
});

const applicationConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  url: z.string().url(),
  icon: z.string(),
  groups: z.array(z.string()),
  requestable: z.boolean().default(false),
  services: z.array(serviceConfigSchema),
});

export const dashboardConfigSchema = z
  .object({
    adminGroup: z.string().default('system-admins'),
    groups: z.array(z.string()),
    applications: z.array(applicationConfigSchema),
  })
  .superRefine((config, ctx) => {
    const knownGroups = new Set(config.groups);

    for (const [appIndex, app] of config.applications.entries()) {
      for (const group of app.groups) {
        if (!knownGroups.has(group)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown group "${group}" referenced by application "${app.id}"`,
            path: ['applications', appIndex, 'groups'],
          });
        }
      }

      for (const [svcIndex, service] of app.services.entries()) {
        if (!service.groups) {
          continue;
        }

        for (const group of service.groups) {
          if (!knownGroups.has(group)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Unknown group "${group}" referenced by service "${service.id}"`,
              path: ['applications', appIndex, 'services', svcIndex, 'groups'],
            });
          }
        }
      }
    }
  });

export type ServiceConfig = z.infer<typeof serviceConfigSchema>;
export type ApplicationConfig = z.infer<typeof applicationConfigSchema>;
export type DashboardConfig = z.infer<typeof dashboardConfigSchema>;
