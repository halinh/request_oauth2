import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryError } from '../src/errors';
import { fetchOidcConfiguration } from '../src/discovery';
import { stubFetchOnce } from './testUtils/mockFetch';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchOidcConfiguration', () => {
  it('fetches the well-known URL and returns the parsed discovery document', async () => {
    const fetchMock = stubFetchOnce({
      ok: true,
      json: {
        authorization_endpoint: 'https://idp.example.com/authorize',
        token_endpoint: 'https://idp.example.com/token',
      },
    });

    const config = await fetchOidcConfiguration('https://idp.example.com/.well-known/openid-configuration');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://idp.example.com/.well-known/openid-configuration',
      expect.anything(),
    );
    expect(config.authorization_endpoint).toBe('https://idp.example.com/authorize');
    expect(config.token_endpoint).toBe('https://idp.example.com/token');
  });

  it('throws a DiscoveryError when the response is not ok', async () => {
    stubFetchOnce({ ok: false, status: 404, json: { error: 'not_found' } });

    await expect(
      fetchOidcConfiguration('https://idp.example.com/.well-known/openid-configuration'),
    ).rejects.toBeInstanceOf(DiscoveryError);
  });
});
