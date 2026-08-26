import type { Claims, Session, TokenResponse } from './types';

export function createSession(tokenResponse: TokenResponse, claims: Claims | null): Session {
  return {
    accessToken: tokenResponse.access_token,
    idToken: tokenResponse.id_token,
    refreshToken: tokenResponse.refresh_token,
    tokenType: tokenResponse.token_type,
    scope: tokenResponse.scope,
    expiresAt: tokenResponse.expires_in !== undefined ? Date.now() + tokenResponse.expires_in * 1000 : null,
    claims,
  };
}

export function isExpired(session: Session, skewSeconds = 0): boolean {
  if (session.expiresAt === null) {
    return false;
  }
  return Date.now() + skewSeconds * 1000 >= session.expiresAt;
}

export function isAuthenticated(session: Session | null | undefined): boolean {
  return Boolean(session?.accessToken) && !isExpired(session as Session);
}

export function getAccessToken(session: Session): string {
  return session.accessToken;
}

export function getClaims(session: Session): Claims | null {
  return session.claims;
}
