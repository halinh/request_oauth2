import { afterEach, describe, expect, it, vi } from 'vitest';
import { OAuth2Error } from '../src/errors';
import { fetchJson } from '../src/http';
import { stubFetchOnce } from './testUtils/mockFetch';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchJson', () => {
  it('returns the parsed JSON body on a successful response', async () => {
    stubFetchOnce({ ok: true, status: 200, json: { hello: 'world' } });

    const result = await fetchJson('https://example.com/data', {}, OAuth2Error);

    expect(result).toEqual({ hello: 'world' });
  });

  it('throws the given error class with status and body on a non-ok response', async () => {
    stubFetchOnce({ ok: false, status: 400, json: { error: 'invalid_request' } });

    await expect(fetchJson('https://example.com/data', {}, OAuth2Error)).rejects.toMatchObject({
      status: 400,
      body: { error: 'invalid_request' },
    });
  });
});
