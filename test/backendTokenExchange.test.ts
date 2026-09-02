import { afterEach, describe, expect, it, vi } from 'vitest';
import { exchangeCodeForTokenViaBackend } from '../src/backendTokenExchange';
import { ProxyTokenExchangeError } from '../src/errors';
import { stubFetchOnce } from './testUtils/mockFetch';

afterEach(() => {
  vi.unstubAllGlobals();
});

const baseParams = {
  tokenProxyEndpoint: 'https://backend.example.com/token',
  code: 'auth-code-123',
  codeVerifier: 'verifier-value',
  redirectUri: 'https://app.example.com/callback',
};

describe('exchangeCodeForTokenViaBackend', () => {
  it('POSTs a credential-free JSON body to the backend proxy and returns the token response with claims', async () => {
    const proxyResponse = {
      access_token: 'at-1',
      id_token: 'idt-1',
      token_type: 'Bearer',
      expires_in: 3600,
      claims: { sub: 'user-1', email: 'user@example.com' },
    };
    const fetchMock = stubFetchOnce({ ok: true, json: proxyResponse });

    const result = await exchangeCodeForTokenViaBackend(baseParams);

    expect(result).toEqual(proxyResponse);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://backend.example.com/token');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({
      code: 'auth-code-123',
      code_verifier: 'verifier-value',
      redirect_uri: 'https://app.example.com/callback',
    });
  });

  it('works when the proxy omits claims', async () => {
    stubFetchOnce({ ok: true, json: { access_token: 'at-1' } });

    const result = await exchangeCodeForTokenViaBackend(baseParams);

    expect(result).toEqual({ access_token: 'at-1' });
    expect(result.claims).toBeUndefined();
  });

  it('throws a ProxyTokenExchangeError when the response is not ok', async () => {
    stubFetchOnce({ ok: false, status: 400, json: { error: 'invalid_grant' } });

    await expect(exchangeCodeForTokenViaBackend(baseParams)).rejects.toBeInstanceOf(
      ProxyTokenExchangeError,
    );
  });

  it('carries the status and body on the thrown error', async () => {
    stubFetchOnce({ ok: false, status: 400, json: { error: 'invalid_grant' } });

    await expect(exchangeCodeForTokenViaBackend(baseParams)).rejects.toMatchObject({
      status: 400,
      body: { error: 'invalid_grant' },
    });
  });
});
