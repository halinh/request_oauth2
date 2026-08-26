export { createOidcClient } from './client';
export type { OidcClient, StartAuthorizationOverrides } from './client';

export { fetchOidcConfiguration } from './discovery';

export { generateCodeChallenge, generateCodeVerifier, generatePkcePair } from './pkce';

export { buildAuthorizationUrl } from './authorizationUrl';
export type { BuildAuthorizationUrlParams, BuildAuthorizationUrlResult } from './authorizationUrl';

export { exchangeCodeForToken } from './tokenExchange';
export type { ExchangeCodeForTokenParams } from './tokenExchange';

export { decodeIdToken } from './decode';
export type { DecodeIdTokenParams } from './decode';

export { createSession, getAccessToken, getClaims, isAuthenticated, isExpired } from './session';

export {
  ConfidentialClientInBrowserError,
  DecodeError,
  DiscoveryError,
  OAuth2Error,
  TokenExchangeError,
} from './errors';
export type { OAuth2ErrorOptions } from './errors';

export type {
  AuthorizationUrlResult,
  Claims,
  OidcClientConfig,
  OidcConfiguration,
  PkcePair,
  Session,
  TokenResponse,
} from './types';
