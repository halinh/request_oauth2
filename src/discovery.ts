import { DiscoveryError } from './errors';
import { fetchJson } from './http';
import type { OidcConfiguration } from './types';

export async function fetchOidcConfiguration(wellKnownUrl: string): Promise<OidcConfiguration> {
  return fetchJson<OidcConfiguration>(wellKnownUrl, { method: 'GET' }, DiscoveryError);
}
