import { generateCodeVerifier } from './pkce';

export interface BuildAuthorizationUrlParams {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod?: 'S256';
  state?: string;
  extraParams?: Record<string, string>;
}

export interface BuildAuthorizationUrlResult {
  url: string;
  state: string;
}

export function buildAuthorizationUrl(params: BuildAuthorizationUrlParams): BuildAuthorizationUrlResult {
  const state = params.state ?? generateCodeVerifier();

  const searchParams = new URLSearchParams({
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: params.scope,
    code_challenge: params.codeChallenge,
    code_challenge_method: params.codeChallengeMethod ?? 'S256',
    state,
    ...params.extraParams,
  });

  const url = `${params.authorizationEndpoint}?${searchParams.toString()}`;

  return { url, state };
}
