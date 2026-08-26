import { describe, expect, it } from 'vitest';
import { generateCodeChallenge, generateCodeVerifier, generatePkcePair } from '../src/pkce';

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

describe('generateCodeVerifier', () => {
  it('produces a base64url string with no padding or unsafe characters', () => {
    const verifier = generateCodeVerifier();

    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces a different verifier on each call', () => {
    const first = generateCodeVerifier();
    const second = generateCodeVerifier();

    expect(first).not.toBe(second);
  });
});

describe('generateCodeChallenge', () => {
  it('matches an independently computed base64url(SHA-256(verifier))', async () => {
    const verifier = 'test-verifier-value';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const expected = base64url(new Uint8Array(digest));

    const challenge = await generateCodeChallenge(verifier);

    expect(challenge).toBe(expected);
  });
});

describe('generatePkcePair', () => {
  it('returns a verifier, a matching S256 challenge, and the method', async () => {
    const pair = await generatePkcePair();

    const expectedChallenge = await generateCodeChallenge(pair.codeVerifier);
    expect(pair.codeChallenge).toBe(expectedChallenge);
    expect(pair.codeChallengeMethod).toBe('S256');
  });
});
