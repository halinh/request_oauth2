import { describe, expect, it } from 'vitest';
import * as publicApi from '../src/index';

describe('public API surface', () => {
  it('exports the composition root and every standalone building block', () => {
    expect(typeof publicApi.createOidcClient).toBe('function');
    expect(typeof publicApi.fetchOidcConfiguration).toBe('function');
    expect(typeof publicApi.generateCodeVerifier).toBe('function');
    expect(typeof publicApi.generateCodeChallenge).toBe('function');
    expect(typeof publicApi.generatePkcePair).toBe('function');
    expect(typeof publicApi.buildAuthorizationUrl).toBe('function');
    expect(typeof publicApi.exchangeCodeForToken).toBe('function');
    expect(typeof publicApi.decodeIdToken).toBe('function');
    expect(typeof publicApi.createSession).toBe('function');
    expect(typeof publicApi.isAuthenticated).toBe('function');
    expect(typeof publicApi.isExpired).toBe('function');
    expect(typeof publicApi.getAccessToken).toBe('function');
    expect(typeof publicApi.getClaims).toBe('function');
  });

  it('exports all error classes', () => {
    expect(typeof publicApi.OAuth2Error).toBe('function');
    expect(typeof publicApi.DiscoveryError).toBe('function');
    expect(typeof publicApi.TokenExchangeError).toBe('function');
    expect(typeof publicApi.DecodeError).toBe('function');
    expect(typeof publicApi.ConfidentialClientInBrowserError).toBe('function');
  });
});
