import { ConfidentialClientInBrowserError, TokenExchangeError } from './errors';
import { fetchJson } from './http';
import type { TokenResponse } from './types';

export interface ExchangeCodeForTokenParams {
  tokenEndpoint: string;
  clientId: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  clientSecret?: string;
}

export async function exchangeCodeForToken(params: ExchangeCodeForTokenParams): Promise<TokenResponse> {
  if (params.clientSecret !== undefined && typeof window !== 'undefined') {
    throw new ConfidentialClientInBrowserError();
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    code: params.code,
    code_verifier: params.codeVerifier,
    ...(params.clientSecret !== undefined ? { client_secret: params.clientSecret } : {}),
  });

  return fetchJson<TokenResponse>(
    params.tokenEndpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
    TokenExchangeError,
  );
}
