import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSession,
  getAccessToken,
  getClaims,
  isAuthenticated,
  isExpired,
} from '../src/session';
import type { TokenResponse } from '../src/types';

describe('createSession', () => {
  it('computes expiresAt from expires_in and carries tokens plus claims', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const tokenResponse: TokenResponse = {
      access_token: 'at-1',
      id_token: 'idt-1',
      refresh_token: 'rt-1',
      token_type: 'Bearer',
      scope: 'openid',
      expires_in: 3600,
    };
    const claims = { sub: 'user-1' };

    const session = createSession(tokenResponse, claims);

    expect(session.accessToken).toBe('at-1');
    expect(session.idToken).toBe('idt-1');
    expect(session.refreshToken).toBe('rt-1');
    expect(session.claims).toEqual(claims);
    expect(session.expiresAt).toBe(new Date('2026-01-01T01:00:00.000Z').getTime());

    vi.useRealTimers();
  });

  it('sets expiresAt to null when expires_in is absent', () => {
    const session = createSession({ access_token: 'at-1' }, null);

    expect(session.expiresAt).toBeNull();
  });
});

describe('isExpired', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false when expiresAt is null (unknown expiry)', () => {
    const session = createSession({ access_token: 'at-1' }, null);

    expect(isExpired(session)).toBe(false);
  });

  it('returns false before expiry and true after expiry', () => {
    const session = createSession({ access_token: 'at-1', expires_in: 60 }, null);

    expect(isExpired(session)).toBe(false);

    vi.setSystemTime(new Date('2026-01-01T00:02:00.000Z'));

    expect(isExpired(session)).toBe(true);
  });
});

describe('isAuthenticated', () => {
  it('is false for a null/undefined session', () => {
    expect(isAuthenticated(null)).toBe(false);
    expect(isAuthenticated(undefined)).toBe(false);
  });

  it('is true for a session with an access token and no expiry', () => {
    const session = createSession({ access_token: 'at-1' }, null);

    expect(isAuthenticated(session)).toBe(true);
  });

  it('is false once the session is expired', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const session = createSession({ access_token: 'at-1', expires_in: 60 }, null);
    vi.setSystemTime(new Date('2026-01-01T00:02:00.000Z'));

    expect(isAuthenticated(session)).toBe(false);

    vi.useRealTimers();
  });
});

describe('accessors', () => {
  it('getAccessToken returns the access token', () => {
    const session = createSession({ access_token: 'at-1' }, null);

    expect(getAccessToken(session)).toBe('at-1');
  });

  it('getClaims returns the claims', () => {
    const session = createSession({ access_token: 'at-1' }, { sub: 'user-1' });

    expect(getClaims(session)).toEqual({ sub: 'user-1' });
  });
});
