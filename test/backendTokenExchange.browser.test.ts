// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exchangeCodeForTokenViaBackend } from '../src/backendTokenExchange';
import { stubFetchOnce } from './testUtils/mockFetch';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('exchangeCodeForTokenViaBackend in a browser context', () => {
  it('is browser-safe: it calls the proxy and resolves without any confidential-client guard', async () => {
    expect(typeof window).toBe('object');
    const fetchMock = stubFetchOnce({ ok: true, json: { access_token: 'at-1', claims: { sub: 'user-1' } } });

    const result = await exchangeCodeForTokenViaBackend({
      tokenProxyEndpoint: 'https://backend.example.com/token',
      code: 'auth-code-123',
      codeVerifier: 'verifier-value',
      redirectUri: 'https://app.example.com/callback',
    });

    expect(result.claims).toEqual({ sub: 'user-1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
