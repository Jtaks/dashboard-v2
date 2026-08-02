import { describe, expect, it } from 'vitest';
import { decodeBase64Url } from './vapid-key.js';

describe('decodeBase64Url', () => {
  it('decodes standard base64url without padding', () => {
    // "hello" in base64url
    const bytes = decodeBase64Url('aGVsbG8');
    expect(Array.from(bytes)).toEqual([104, 101, 108, 108, 111]);
  });

  it('decodes base64url with URL-safe characters', () => {
    // bytes [0xfb, 0xff] → "+/8=" in base64 → "-_8" in base64url
    const bytes = decodeBase64Url('-_8');
    expect(Array.from(bytes)).toEqual([0xfb, 0xff]);
  });

  it('accepts already-padded input', () => {
    const bytes = decodeBase64Url('aGVsbG8=');
    expect(Array.from(bytes)).toEqual([104, 101, 108, 108, 111]);
  });

  it('round-trips a typical VAPID-length key shape', () => {
    // 65-byte uncompressed public key pattern (prefix 0x04 + 32 + 32)
    const raw = new Uint8Array(65);
    raw[0] = 0x04;
    for (let i = 1; i < 65; i++) {
      raw[i] = i;
    }
    const base64 = Buffer.from(raw).toString('base64');
    const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(Array.from(decodeBase64Url(base64url))).toEqual(Array.from(raw));
  });
});
