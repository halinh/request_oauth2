import { ProxyTokenExchangeError } from './errors';
import { fetchJson } from './http';
import type { ProxyTokenResponse } from './types';

export interface ExchangeCodeForTokenViaBackendParams {
  tokenProxyEndpoint: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export async function exchangeCodeForTokenViaBackend(
  params: ExchangeCodeForTokenViaBackendParams,
): Promise<ProxyTokenResponse> {
  return fetchJson<ProxyTokenResponse>(
    params.tokenProxyEndpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: params.code,
        code_verifier: params.codeVerifier,
        redirect_uri: params.redirectUri,
      }),
    },
    ProxyTokenExchangeError,
  );
}
