import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { findInlineStrings, formatInlineStringReport } from './check-inline-strings.js';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

it('fails the inline-string check when src components contain literals', () => {
  const hits = findInlineStrings(srcRoot).filter(
    (hit) => hit.file.startsWith('routes/') || hit.file.startsWith('lib/components/'),
  );
  expect(hits, formatInlineStringReport(hits)).toEqual([]);
});
