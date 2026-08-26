import { vi } from 'vitest';

export interface StubFetchResponse {
  ok?: boolean;
  status?: number;
  json?: unknown;
}

export function stubFetchOnce(response: StubFetchResponse): ReturnType<typeof vi.fn> {
  const { ok = true, status = 200, json = {} } = response;
  const fetchMock = vi.fn().mockResolvedValueOnce({
    ok,
    status,
    json: async () => json,
  } as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
