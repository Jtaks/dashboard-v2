import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'svelte/compiler';

export type InlineStringHit = {
  file: string;
  line: number;
  column: number;
  text: string;
};

function walkDir(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkDir(full, files);
    } else if (entry.endsWith('.svelte')) {
      files.push(full);
    }
  }
  return files;
}

function isUserFacingText(raw: string): boolean {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) {
    return false;
  }
  return /[A-Za-z]/.test(text);
}

function addHit(
  hits: InlineStringHit[],
  file: string,
  source: string,
  start: number,
  data: string,
): void {
  if (!isUserFacingText(data)) {
    return;
  }
  const before = source.slice(0, start);
  const line = before.split('\n').length;
  const column = start - before.lastIndexOf('\n');
  hits.push({
    file,
    line,
    column,
    text: data.replace(/\s+/g, ' ').trim(),
  });
}

/** Walk template content only — never attribute values (test ids, hrefs, etc.). */
function walkFragment(
  fragment: { nodes?: unknown[] } | null | undefined,
  hits: InlineStringHit[],
  file: string,
  source: string,
): void {
  if (!fragment?.nodes) {
    return;
  }

  for (const node of fragment.nodes) {
    walkContentNode(node, hits, file, source);
  }
}

function walkContentNode(
  node: unknown,
  hits: InlineStringHit[],
  file: string,
  source: string,
): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  const record = node as Record<string, unknown>;

  switch (record.type) {
    case 'Text':
      if (typeof record.data === 'string' && typeof record.start === 'number') {
        addHit(hits, file, source, record.start, record.data);
      }
      return;
    case 'RegularElement':
    case 'Component':
    case 'SvelteElement':
    case 'SvelteComponent':
    case 'SvelteFragment':
    case 'SvelteHead':
    case 'SvelteWindow':
    case 'SvelteBody':
    case 'SvelteDocument':
    case 'TitleElement':
      walkFragment(record.fragment as { nodes?: unknown[] }, hits, file, source);
      return;
    case 'IfBlock':
      walkFragment(record.consequent as { nodes?: unknown[] }, hits, file, source);
      walkFragment(record.alternate as { nodes?: unknown[] }, hits, file, source);
      return;
    case 'EachBlock':
      walkFragment(record.body as { nodes?: unknown[] }, hits, file, source);
      walkFragment(record.fallback as { nodes?: unknown[] }, hits, file, source);
      return;
    case 'AwaitBlock':
      walkFragment(record.pending as { nodes?: unknown[] }, hits, file, source);
      walkFragment(record.then as { nodes?: unknown[] }, hits, file, source);
      walkFragment(record.catch as { nodes?: unknown[] }, hits, file, source);
      return;
    case 'KeyBlock':
    case 'SnippetBlock':
      walkFragment(record.body as { nodes?: unknown[] }, hits, file, source);
      return;
    case 'SlotElement':
      walkFragment(record.fragment as { nodes?: unknown[] }, hits, file, source);
      return;
    default:
      return;
  }
}

/** Fail when a .svelte file contains literal user-facing text instead of catalog messages. */
export function findInlineStrings(rootDir: string): InlineStringHit[] {
  const hits: InlineStringHit[] = [];
  const files = walkDir(rootDir);

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    let ast;
    try {
      ast = parse(source, { modern: true });
    } catch {
      continue;
    }
    const rel = relative(rootDir, file).replaceAll('\\', '/');
    walkFragment(ast.fragment, hits, rel, source);
  }

  return hits;
}

export function formatInlineStringReport(hits: InlineStringHit[]): string {
  return hits
    .map((hit) => `${hit.file}:${hit.line}:${hit.column}: inline string "${hit.text}"`)
    .join('\n');
}
