// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOidcClient } from '../src/client';
import { ConfidentialClientInBrowserError } from '../src/errors';

afterEach(() => {
  vi.unstubAllGlobals();
});

const config = {
  wellKnownUrl: 'https://idp.example.com/.well-known/openid-configuration',
  clientId: 'my-client',
  clientSecret: 'shh-secret',
  redirectUri: 'https://app.example.com/callback',
  scope: 'openid profile',
  decodeEndpoint: 'https://backend.example.com/decode',
};

const TOKEN_ENDPOINT = 'https://idp.example.com/token';

describe('createOidcClient in a browser context', () => {
  it('authenticate() rejects with ConfidentialClientInBrowserError before the token request', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === config.wellKnownUrl) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            authorization_endpoint: 'https://idp.example.com/authorize',
            token_endpoint: TOKEN_ENDPOINT,
          }),
        } as Response;
      }
      throw new Error(`unexpected fetch to ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createOidcClient(config);

    await expect(client.authenticate('auth-code', 'a-code-verifier')).rejects.toBeInstanceOf(
      ConfidentialClientInBrowserError,
    );

    const fetchedUrls = fetchMock.mock.calls.map(([url]) => url);
    expect(fetchedUrls).toContain(config.wellKnownUrl);
    expect(fetchedUrls).not.toContain(TOKEN_ENDPOINT);
  });
});
