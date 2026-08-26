import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecodeError } from '../src/errors';
import { decodeIdToken } from '../src/decode';
import { stubFetchOnce } from './testUtils/mockFetch';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('decodeIdToken', () => {
  it('POSTs the id_token to the backend decode endpoint and returns the claims', async () => {
    const fetchMock = stubFetchOnce({ ok: true, json: { sub: 'user-1', email: 'user@example.com' } });

    const claims = await decodeIdToken({
      decodeEndpoint: 'https://backend.example.com/decode',
      idToken: 'header.payload.signature',
    });

    expect(claims).toEqual({ sub: 'user-1', email: 'user@example.com' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://backend.example.com/decode');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ id_token: 'header.payload.signature' });
  });

  it('throws a DecodeError when the response is not ok', async () => {
    stubFetchOnce({ ok: false, status: 422, json: { error: 'invalid_token' } });

    await expect(
      decodeIdToken({ decodeEndpoint: 'https://backend.example.com/decode', idToken: 'bad-token' }),
    ).rejects.toBeInstanceOf(DecodeError);
  });
});
