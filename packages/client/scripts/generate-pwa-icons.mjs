/**
 * Generates PWA install icons (solid brand tiles). Run after changing colours or sizes.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(scriptDir, '../static/pwa');

const BRAND = { r: 0x15, g: 0x65, b: 0xc0 };
const PAGE = { r: 0xff, g: 0xff, b: 0xff };

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function createSolidPng(width, height, colour) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const row = Buffer.alloc(1 + width * 3);
  row[0] = 0;
  for (let x = 0; x < width; x += 1) {
    const offset = 1 + x * 3;
    row[offset] = colour.r;
    row[offset + 1] = colour.g;
    row[offset + 2] = colour.b;
  }

  const raw = Buffer.alloc(row.length * height);
  for (let y = 0; y < height; y += 1) {
    row.copy(raw, y * row.length);
  }

  const idat = deflateSync(raw);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function createMaskablePng(size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const safeInset = Math.round(size * 0.1);
  const row = Buffer.alloc(1 + size * 3);
  const raw = Buffer.alloc(row.length * size);

  for (let y = 0; y < size; y += 1) {
    row[0] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = 1 + x * 3;
      const inSafeZone =
        x >= safeInset &&
        x < size - safeInset &&
        y >= safeInset &&
        y < size - safeInset;
      const colour = inSafeZone ? BRAND : PAGE;
      row[offset] = colour.r;
      row[offset + 1] = colour.g;
      row[offset + 2] = colour.b;
    }
    row.copy(raw, y * row.length);
  }

  const idat = deflateSync(raw);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(outDir, { recursive: true });

const files = [
  ['icon-192.png', createSolidPng(192, 192, BRAND)],
  ['icon-512.png', createSolidPng(512, 512, BRAND)],
  ['icon-maskable-192.png', createMaskablePng(192)],
  ['icon-maskable-512.png', createMaskablePng(512)],
  ['apple-touch-icon.png', createSolidPng(180, 180, BRAND)],
];

for (const [name, data] of files) {
  writeFileSync(join(outDir, name), data);
}

console.log(`Wrote ${files.length} PWA icons to ${outDir}`);
