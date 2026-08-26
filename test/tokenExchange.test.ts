import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenExchangeError } from '../src/errors';
import { exchangeCodeForToken } from '../src/tokenExchange';
import { stubFetchOnce } from './testUtils/mockFetch';

afterEach(() => {
  vi.unstubAllGlobals();
});

const baseParams = {
  tokenEndpoint: 'https://idp.example.com/token',
  clientId: 'my-client',
  redirectUri: 'https://app.example.com/callback',
  code: 'auth-code-123',
  codeVerifier: 'verifier-value',
};

describe('exchangeCodeForToken', () => {
  it('POSTs a form-encoded authorization_code request and returns the token response', async () => {
    const fetchMock = stubFetchOnce({ ok: true, json: { access_token: 'at-1', token_type: 'Bearer' } });

    const result = await exchangeCodeForToken(baseParams);

    expect(result).toEqual({ access_token: 'at-1', token_type: 'Bearer' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://idp.example.com/token');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/x-www-form-urlencoded' });
    const body = new URLSearchParams(init.body);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('client_id')).toBe('my-client');
    expect(body.get('redirect_uri')).toBe('https://app.example.com/callback');
    expect(body.get('code')).toBe('auth-code-123');
    expect(body.get('code_verifier')).toBe('verifier-value');
  });

  it('includes client_secret in the body when provided (server-side/confidential usage)', async () => {
    const fetchMock = stubFetchOnce({ ok: true, json: { access_token: 'at-1' } });

    await exchangeCodeForToken({ ...baseParams, clientSecret: 'shh-secret' });

    const [, init] = fetchMock.mock.calls[0];
    const body = new URLSearchParams(init.body);
    expect(body.get('client_secret')).toBe('shh-secret');
  });

  it('throws a TokenExchangeError when the response is not ok', async () => {
    stubFetchOnce({ ok: false, status: 400, json: { error: 'invalid_grant' } });

    await expect(exchangeCodeForToken(baseParams)).rejects.toBeInstanceOf(TokenExchangeError);
  });
});
