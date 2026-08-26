// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfidentialClientInBrowserError } from '../src/errors';
import { exchangeCodeForToken } from '../src/tokenExchange';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('exchangeCodeForToken in a browser context', () => {
  it('refuses to send a clientSecret and never calls fetch', async () => {
    expect(typeof window).toBe('object');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      exchangeCodeForToken({
        tokenEndpoint: 'https://idp.example.com/token',
        clientId: 'my-client',
        redirectUri: 'https://app.example.com/callback',
        code: 'auth-code-123',
        codeVerifier: 'verifier-value',
        clientSecret: 'shh-secret',
      }),
    ).rejects.toBeInstanceOf(ConfidentialClientInBrowserError);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
