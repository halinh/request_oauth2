import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOidcClient } from '../src/client';
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
};

function stubRoutedFetch() {
  const fetchMock = vi.fn(async (url: string) => {
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
});
