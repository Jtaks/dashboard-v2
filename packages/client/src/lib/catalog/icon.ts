export const PLACEHOLDER_ICON_PATH = '/icons/placeholder.svg';

export function resolveIconPath(icon: string): string {
  return `/icons/${icon}`;
}

export function resolveIconSrc(icon: string, usePlaceholder: boolean): string {
  return usePlaceholder ? PLACEHOLDER_ICON_PATH : resolveIconPath(icon);
}
