import { describe, expect, it } from 'vitest';
import {
  ConfidentialClientInBrowserError,
  DecodeError,
  DiscoveryError,
  OAuth2Error,
  TokenExchangeError,
} from '../src/errors';

describe('OAuth2Error', () => {
  it('carries a message, status, and body', () => {
    const error = new OAuth2Error('discovery failed', { status: 500, body: { detail: 'boom' } });

    expect(error.message).toBe('discovery failed');
    expect(error.status).toBe(500);
    expect(error.body).toEqual({ detail: 'boom' });
    expect(error).toBeInstanceOf(Error);
  });

  it.each([
    ['DiscoveryError', DiscoveryError],
    ['TokenExchangeError', TokenExchangeError],
    ['DecodeError', DecodeError],
    ['ConfidentialClientInBrowserError', ConfidentialClientInBrowserError],
  ])('%s is an instance of OAuth2Error', (_name, ErrorClass) => {
    const error = new ErrorClass('some message');

    expect(error).toBeInstanceOf(OAuth2Error);
    expect(error).toBeInstanceOf(Error);
  });
});
