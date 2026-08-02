import * as m from '$lib/paraglide/messages';

const flagDescriptions = {
  flag_dependency_summary_popover_description: m.flag_dependency_summary_popover_description,
  flag_admin_experimental_tools_description: m.flag_admin_experimental_tools_description,
} as const satisfies Record<string, () => string>;

export function resolveFlagDescription(key: string): string {
  const message = flagDescriptions[key as keyof typeof flagDescriptions];
  return message ? message() : key;
}
