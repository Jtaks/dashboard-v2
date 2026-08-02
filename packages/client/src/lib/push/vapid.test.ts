import { describe, expect, it } from 'vitest';

import { decodeBase64Url } from './vapid.js';

const TEST_VAPID_PUBLIC_KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

describe('decodeBase64Url', () => {
  it('decodes a VAPID public key from base64url', () => {
    const decoded = decodeBase64Url(TEST_VAPID_PUBLIC_KEY);

    expect(decoded).toBeInstanceOf(Uint8Array);
    expect(decoded.length).toBe(65);
    expect(decoded[0]).toBe(0x04);
  });

  it('handles padding-free base64url input', () => {
    expect(decodeBase64Url('YQ')).toEqual(new Uint8Array([0x61]));
    expect(decodeBase64Url('YWI')).toEqual(new Uint8Array([0x61, 0x62]));
  });
});
