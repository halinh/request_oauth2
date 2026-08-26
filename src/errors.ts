export interface OAuth2ErrorOptions {
  status?: number;
  body?: unknown;
  cause?: unknown;
}

export class OAuth2Error extends Error {
  readonly status?: number;
  readonly body?: unknown;

  constructor(message: string, options?: OAuth2ErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.status = options?.status;
    this.body = options?.body;
  }
}

export class DiscoveryError extends OAuth2Error {}

export class TokenExchangeError extends OAuth2Error {}

export class DecodeError extends OAuth2Error {}

export class ConfidentialClientInBrowserError extends OAuth2Error {
  constructor(message = 'clientSecret was provided but code is running in a browser; confidential-client credentials must never ship to a browser bundle. Omit clientSecret and use PKCE instead, or perform this exchange from a server/backend proxy.') {
    super(message);
  }
}
