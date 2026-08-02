import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findInlineStrings } from './check-inline-strings.js';

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe('findInlineStrings', () => {
  it('fails when a component contains a literal user-facing string', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'inline-strings-'));
    mkdirSync(join(tempDir, 'routes'), { recursive: true });
    writeFileSync(join(tempDir, 'routes', 'Bad.svelte'), `<p>Hello from a literal</p>\n`);

    const hits = findInlineStrings(tempDir);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((hit) => hit.text.includes('Hello'))).toBe(true);
  });

  it('passes when the same string is resolved from the catalog', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'inline-strings-'));
    mkdirSync(join(tempDir, 'routes'), { recursive: true });
    writeFileSync(
      join(tempDir, 'routes', 'Good.svelte'),
      `<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
</script>

<p>{m.sign_in()}</p>
`,
    );

    const hits = findInlineStrings(tempDir);
    expect(hits).toEqual([]);
  });
});
