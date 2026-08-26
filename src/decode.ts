import { DecodeError } from './errors';
import { fetchJson } from './http';
import type { Claims } from './types';

export interface DecodeIdTokenParams {
  decodeEndpoint: string;
  idToken: string;
}

export async function decodeIdToken(params: DecodeIdTokenParams): Promise<Claims> {
  return fetchJson<Claims>(
    params.decodeEndpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: params.idToken }),
    },
    DecodeError,
  );
}
