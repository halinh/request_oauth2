export interface OidcClientConfig {
  wellKnownUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  decodeEndpoint?: string;
  clientSecret?: string;
  tokenProxyEndpoint?: string;
}

export interface OidcConfiguration {
  authorization_endpoint: string;
  token_endpoint: string;
  issuer?: string;
  [key: string]: unknown;
}

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export interface AuthorizationUrlResult {
  url: string;
  state: string;
  codeVerifier: string;
}

export interface TokenResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  [key: string]: unknown;
}

export type Claims = Record<string, unknown>;

export interface ProxyTokenResponse extends TokenResponse {
  claims?: Claims;
}

export interface Session {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  expiresAt: number | null;
  claims: Claims | null;
}
