import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOidcClient } from '../src/client';
import { DecodeError, ProxyTokenExchangeError } from '../src/errors';
import { generateCodeChallenge } from '../src/pkce';

afterEach(() => {
  vi.unstubAllGlobals();
});

const config = {
  wellKnownUrl: 'https://idp.example.com/.well-known/openid-configuration',
  clientId: 'my-client',
  redirectUri: 'https://app.example.com/callback',
  scope: 'openid profile',
  decodeEndpoint: 'https://backend.example.com/decode',
  tokenProxyEndpoint: 'https://backend.example.com/token',
};

function stubRoutedFetch() {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url === config.wellKnownUrl) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          authorization_endpoint: 'https://idp.example.com/authorize',
          token_endpoint: 'https://idp.example.com/token',
        }),
      } as Response;
    }
    if (url === 'https://idp.example.com/token') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'at-1', id_token: 'idt-1', expires_in: 3600 }),
      } as Response;
    }
    if (url === config.decodeEndpoint) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ sub: 'user-1' }),
      } as Response;
    }
    if (url === config.tokenProxyEndpoint) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'at-2', id_token: 'idt-2', claims: { sub: 'user-1' } }),
      } as Response;
    }
    throw new Error(`Unexpected fetch to ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('createOidcClient', () => {
  it('startAuthorization returns a PKCE authorization url, state, and code verifier', async () => {
    stubRoutedFetch();
    const client = createOidcClient(config);

    const result = await client.startAuthorization();

    const expectedChallenge = await generateCodeChallenge(result.codeVerifier);
    const parsed = new URL(result.url);
    expect(parsed.searchParams.get('code_challenge')).toBe(expectedChallenge);
    expect(parsed.searchParams.get('state')).toBe(result.state);
  });

  it('authenticate() composes exchange -> decode -> session, fetching discovery only once', async () => {
    const fetchMock = stubRoutedFetch();
    const client = createOidcClient(config);

    await client.startAuthorization();
    const session = await client.authenticate('auth-code', 'a-code-verifier');

    expect(session.accessToken).toBe('at-1');
    expect(session.idToken).toBe('idt-1');
    expect(session.claims).toEqual({ sub: 'user-1' });

    const discoveryCalls = fetchMock.mock.calls.filter(([url]) => url === config.wellKnownUrl);
    expect(discoveryCalls).toHaveLength(1);
  });

  it('exchangeCodeForTokenViaBackend() POSTs a credential-free JSON body to the proxy without hitting discovery', async () => {
    const fetchMock = stubRoutedFetch();
    const client = createOidcClient(config);

    const result = await client.exchangeCodeForTokenViaBackend('auth-code', 'a-code-verifier');

    expect(result.access_token).toBe('at-2');
    expect(result.claims).toEqual({ sub: 'user-1' });

    const discoveryCalls = fetchMock.mock.calls.filter(([url]) => url === config.wellKnownUrl);
    expect(discoveryCalls).toHaveLength(0);

    const proxyCall = fetchMock.mock.calls.find(([url]) => url === config.tokenProxyEndpoint);
    expect(proxyCall).toBeDefined();
    const init = proxyCall![1]!;
    expect(JSON.parse(init.body as string)).toEqual({
      code: 'auth-code',
      code_verifier: 'a-code-verifier',
      redirect_uri: config.redirectUri,
    });
  });

  it('exchangeCodeForTokenViaBackend() rejects when tokenProxyEndpoint is not configured, without any fetch', async () => {
    const fetchMock = stubRoutedFetch();
    const { tokenProxyEndpoint: _omit, ...configWithoutProxy } = config;
    const client = createOidcClient(configWithoutProxy);

    await expect(
      client.exchangeCodeForTokenViaBackend('auth-code', 'a-code-verifier'),
    ).rejects.toBeInstanceOf(ProxyTokenExchangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('decodeIdToken() rejects when decodeEndpoint is not configured', async () => {
    stubRoutedFetch();
    const { decodeEndpoint: _omit, ...configWithoutDecode } = config;
    const client = createOidcClient(configWithoutDecode);

    await expect(client.decodeIdToken('idt-1')).rejects.toBeInstanceOf(DecodeError);
  });
});
