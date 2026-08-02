import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const USER_FACING_TEXT = />\s*([^<{][^<]*?[A-Za-z]{2,}[^<]*?)\s*</g;

const ALLOWED_PATTERNS = [/^\s*\{/, /^\s*$/, /^\s*&[a-z]+;\s*$/i];

function isAllowedText(text: string): boolean {
  const trimmed = text.trim();
  return ALLOWED_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function extractTemplateMarkup(source: string): string {
  const withoutScript = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  return withoutScript.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

export function findInlineStrings(source: string): string[] {
  const markup = extractTemplateMarkup(source);
  const matches: string[] = [];

  for (const match of markup.matchAll(USER_FACING_TEXT)) {
    const text = match[1]?.trim();
    if (!text || isAllowedText(text)) {
      continue;
    }

    matches.push(text);
  }

  return matches;
}

async function collectSvelteFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSvelteFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.svelte')) {
      files.push(fullPath);
    }
  }

  return files;
}

export type InlineStringViolation = {
  file: string;
  text: string;
};

export async function findInlineStringViolations(
  routesDirectory: string,
): Promise<InlineStringViolation[]> {
  const files = await collectSvelteFiles(routesDirectory);
  const violations: InlineStringViolation[] = [];

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const text of findInlineStrings(source)) {
      violations.push({ file, text });
    }
  }

  return violations;
}
