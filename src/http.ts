import type { OAuth2Error, OAuth2ErrorOptions } from './errors';

type OAuth2ErrorConstructor = new (message: string, options?: OAuth2ErrorOptions) => OAuth2Error;

export async function fetchJson<T>(
  url: string,
  init: RequestInit,
  ErrorClass: OAuth2ErrorConstructor,
): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();

  if (!response.ok) {
    throw new ErrorClass(`Request to ${url} failed with status ${response.status}`, {
      status: response.status,
      body,
    });
  }

  return body as T;
}
