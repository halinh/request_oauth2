import { buildAuthorizationUrl } from './authorizationUrl';
import { decodeIdToken as decodeIdTokenRequest } from './decode';
import { fetchOidcConfiguration } from './discovery';
import { generatePkcePair } from './pkce';
import { createSession as buildSession } from './session';
import { exchangeCodeForToken as exchangeCodeForTokenRequest } from './tokenExchange';
import type { AuthorizationUrlResult, Claims, OidcClientConfig, Session, TokenResponse } from './types';

export interface StartAuthorizationOverrides {
  state?: string;
  extraParams?: Record<string, string>;
}

export interface OidcClient {
  startAuthorization(overrides?: StartAuthorizationOverrides): Promise<AuthorizationUrlResult>;
  exchangeCodeForToken(code: string, codeVerifier: string): Promise<TokenResponse>;
  decodeIdToken(idToken: string): Promise<Claims>;
  createSession(tokenResponse: TokenResponse, claims: Claims | null): Session;
  authenticate(code: string, codeVerifier: string): Promise<Session>;
}

export function createOidcClient(config: OidcClientConfig): OidcClient {
  let discoveryPromise: ReturnType<typeof fetchOidcConfiguration> | undefined;

  function discover() {
    if (!discoveryPromise) {
      discoveryPromise = fetchOidcConfiguration(config.wellKnownUrl);
    }
    return discoveryPromise;
  }

  async function startAuthorization(overrides?: StartAuthorizationOverrides): Promise<AuthorizationUrlResult> {
    const [discovery, pkce] = await Promise.all([discover(), generatePkcePair()]);

    const { url, state } = buildAuthorizationUrl({
      authorizationEndpoint: discovery.authorization_endpoint,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      scope: config.scope,
      codeChallenge: pkce.codeChallenge,
      state: overrides?.state,
      extraParams: overrides?.extraParams,
    });

    return { url, state, codeVerifier: pkce.codeVerifier };
  }

  async function exchangeCodeForToken(code: string, codeVerifier: string): Promise<TokenResponse> {
    const discovery = await discover();

    return exchangeCodeForTokenRequest({
      tokenEndpoint: discovery.token_endpoint,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      code,
      codeVerifier,
      clientSecret: config.clientSecret,
    });
  }

  async function decodeIdToken(idToken: string): Promise<Claims> {
    return decodeIdTokenRequest({ decodeEndpoint: config.decodeEndpoint, idToken });
  }

  function createSession(tokenResponse: TokenResponse, claims: Claims | null): Session {
    return buildSession(tokenResponse, claims);
  }

  async function authenticate(code: string, codeVerifier: string): Promise<Session> {
    const tokenResponse = await exchangeCodeForToken(code, codeVerifier);
    const claims = tokenResponse.id_token !== undefined ? await decodeIdToken(tokenResponse.id_token) : null;
    return createSession(tokenResponse, claims);
  }

  return { startAuthorization, exchangeCodeForToken, decodeIdToken, createSession, authenticate };
}
