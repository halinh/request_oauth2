import { describe, expect, it } from 'vitest';
import { buildAuthorizationUrl } from '../src/authorizationUrl';

const baseParams = {
  authorizationEndpoint: 'https://idp.example.com/authorize',
  clientId: 'my-client',
  redirectUri: 'https://app.example.com/callback',
  scope: 'openid profile',
  codeChallenge: 'challenge-value',
};

describe('buildAuthorizationUrl', () => {
  it('includes all required OAuth2/PKCE parameters', () => {
    const { url } = buildAuthorizationUrl({ ...baseParams, state: 'fixed-state' });
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe('https://idp.example.com/authorize');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('my-client');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://app.example.com/callback');
    expect(parsed.searchParams.get('scope')).toBe('openid profile');
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('state')).toBe('fixed-state');
  });

  it('generates a state when none is provided, and returns it alongside the url', () => {
    const { url, state } = buildAuthorizationUrl(baseParams);
    const parsed = new URL(url);

    expect(state).toBeTruthy();
    expect(parsed.searchParams.get('state')).toBe(state);
  });

  it('merges extraParams into the query string', () => {
    const { url } = buildAuthorizationUrl({
      ...baseParams,
      state: 'fixed-state',
      extraParams: { prompt: 'consent' },
    });
    const parsed = new URL(url);

    expect(parsed.searchParams.get('prompt')).toBe('consent');
  });
});
