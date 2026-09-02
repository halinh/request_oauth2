# request-oauth2

Isomorphic TypeScript client for the OIDC / OAuth2 **`authorization_code` + PKCE**
flow. It reads the OIDC discovery document, builds the authorization URL,
exchanges the authorization code for tokens, and turns the result into a plain
session object.

- **Runs unchanged in Node 18+ and the browser** — only global `fetch` and Web
  Crypto, **zero runtime dependencies**.
- **PKCE is always on** (`code_challenge_method=S256`).
- **Never decodes or verifies a JWT itself.** `decodeIdToken` POSTs the token to
  an endpoint you control.
- **Persists nothing.** `state`, `codeVerifier`, and the `Session` are yours to
  store across the redirect.
- Functional API — a client factory plus standalone functions, dual ESM/CJS.

## Install

```sh
npm install request-oauth2
```

## Three ways to exchange the code

The redirect and PKCE steps are identical everywhere. What differs is **where the
token exchange runs** and **who holds the `client_secret`**:

| Pattern | Token exchange | `client_secret` | Use |
| --- | --- | --- | --- |
| **Public client** | `exchangeCodeForToken` in the browser, straight to the IdP | none (PKCE only) | SPA against an IdP that allows public clients |
| **Backend proxy** | `exchangeCodeForTokenViaBackend` → your `/token` proxy → IdP | held by your proxy | SPA (or any client) that must authenticate as a confidential client without shipping the secret |
| **Server-side** | `exchangeCodeForToken` on your server, with `clientSecret` | held by your server | classic web app / BFF |

A `client_secret` must **never** reach browser code. `exchangeCodeForToken`
throws `ConfidentialClientInBrowserError` synchronously — before any network
call — if `clientSecret` is set while `typeof window !== 'undefined'`.

## Quick start — `createOidcClient`

`createOidcClient(config)` wires discovery, PKCE, exchange, decode, and session
creation into one object. Discovery is fetched once per client and memoized.

```ts
import { createOidcClient } from 'request-oauth2';

const client = createOidcClient({
  wellKnownUrl: 'https://idp.example.com/.well-known/openid-configuration',
  clientId: process.env.OIDC_CLIENT_ID!,
  redirectUri: 'https://app.example.com/callback',
  scope: 'openid profile email',
  clientSecret: process.env.OIDC_CLIENT_SECRET, // server-side only; omit in a browser
  decodeEndpoint: 'https://app.example.com/api/decode', // for authenticate() / decodeIdToken()
});

// GET /login
app.get('/login', async (req, res) => {
  const { url, state, codeVerifier } = await client.startAuthorization();
  req.session.oauth = { state, codeVerifier }; // persist across the redirect
  res.redirect(url);
});

// GET /callback?code=...&state=...
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (state !== req.session.oauth.state) return res.status(400).send('state mismatch');

  // authenticate() = exchangeCodeForToken -> decodeIdToken (if an id_token came back) -> createSession
  req.session.user = await client.authenticate(code, req.session.oauth.codeVerifier);
  res.redirect('/');
});
```

`config.clientSecret` and `config.decodeEndpoint` are optional. Set
`tokenProxyEndpoint` instead to make the client use the backend-proxy exchange
(below) via `client.exchangeCodeForTokenViaBackend(code, codeVerifier)`.

## Browser, public client (PKCE only)

No secret, no client factory needed — compose the standalone functions:

```tsx
import {
  fetchOidcConfiguration,
  generatePkcePair,
  buildAuthorizationUrl,
  exchangeCodeForToken,
  decodeIdToken,
  createSession,
} from 'request-oauth2';

const CONFIG = {
  wellKnownUrl: 'https://idp.example.com/.well-known/openid-configuration',
  clientId: 'my-public-client',
  redirectUri: 'https://app.example.com/callback',
  scope: 'openid profile email',
  decodeEndpoint: 'https://app.example.com/api/decode',
};

async function login() {
  const discovery = await fetchOidcConfiguration(CONFIG.wellKnownUrl);
  const pkce = await generatePkcePair();

  const { url, state } = buildAuthorizationUrl({
    authorizationEndpoint: discovery.authorization_endpoint,
    clientId: CONFIG.clientId,
    redirectUri: CONFIG.redirectUri,
    scope: CONFIG.scope,
    codeChallenge: pkce.codeChallenge,
  });

  // Store { state, codeVerifier } somewhere that survives the redirect (e.g. sessionStorage).
  sessionStorage.setItem('oauth', JSON.stringify({ state, codeVerifier: pkce.codeVerifier }));
  window.location.href = url;
}

// On the /callback page:
async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const { state, codeVerifier } = JSON.parse(sessionStorage.getItem('oauth')!);
  if (params.get('state') !== state) throw new Error('state mismatch');

  const discovery = await fetchOidcConfiguration(CONFIG.wellKnownUrl);
  const tokens = await exchangeCodeForToken({
    tokenEndpoint: discovery.token_endpoint,
    clientId: CONFIG.clientId,
    redirectUri: CONFIG.redirectUri,
    code: params.get('code')!,
    codeVerifier,
  });

  const claims = tokens.id_token
    ? await decodeIdToken({ decodeEndpoint: CONFIG.decodeEndpoint, idToken: tokens.id_token })
    : null;

  return createSession(tokens, claims);
}
```

## Browser or server, confidential via a backend proxy

Drive a **confidential** client without the browser ever holding the secret.
`exchangeCodeForTokenViaBackend` POSTs a credential-free JSON body —
`{ code, code_verifier, redirect_uri }` and nothing else — to a small `/token`
proxy of yours. The proxy adds `client_id` + `client_secret`, forwards to the
real token endpoint, and (optionally) decodes the `id_token`, returning the token
response with a `claims` object attached:

```ts
import { exchangeCodeForTokenViaBackend, createSession } from 'request-oauth2';

const tokens = await exchangeCodeForTokenViaBackend({
  tokenProxyEndpoint: 'https://app.example.com/api/token',
  code,
  codeVerifier,
  redirectUri: 'https://app.example.com/callback',
});

// The proxy already decoded the id_token — no separate decodeIdToken round-trip.
const session = createSession(tokens, tokens.claims ?? null);
```

A non-2xx from the proxy rejects with `ProxyTokenExchangeError` (carrying
`status` and the parsed `body`). The same call works from a server route — it
sends no credentials and never triggers the browser guard.

**The proxy is yours to build.** A minimal one: accept the JSON body, add
`grant_type=authorization_code` + your `client_id` + `client_secret`,
`POST` it form-encoded to the IdP's `token_endpoint`, and return the JSON
response (optionally verifying the `id_token` and adding `claims`). The
`decode-service` + `react-login` + `next-login` demos under `docs/` implement
exactly this.

## API reference

### `createOidcClient(config): OidcClient`

`config` (`OidcClientConfig`): `wellKnownUrl`, `clientId`, `redirectUri`,
`scope` (required); `clientSecret`, `decodeEndpoint`, `tokenProxyEndpoint`
(optional).

| Method | Description |
| --- | --- |
| `startAuthorization(overrides?)` | Runs discovery + PKCE, returns `{ url, state, codeVerifier }`. `overrides`: `{ state?, extraParams? }`. |
| `exchangeCodeForToken(code, codeVerifier)` | Exchanges against the discovered `token_endpoint`, using `config.clientSecret` if present. → `TokenResponse` |
| `exchangeCodeForTokenViaBackend(code, codeVerifier)` | Exchanges via `config.tokenProxyEndpoint` (no discovery call). Throws `ProxyTokenExchangeError` if the endpoint is not configured. → `ProxyTokenResponse` |
| `decodeIdToken(idToken)` | POSTs to `config.decodeEndpoint`. Throws `DecodeError` if it is not configured. → `Claims` |
| `createSession(tokenResponse, claims)` | Builds a `Session`. |
| `authenticate(code, codeVerifier)` | `exchangeCodeForToken` → `decodeIdToken` (only if an `id_token` came back) → `createSession`. → `Session` |

### Standalone functions

| Export | Description |
| --- | --- |
| `fetchOidcConfiguration(wellKnownUrl)` | Fetches and parses the discovery document. → `OidcConfiguration` |
| `generateCodeVerifier(length?)` / `generateCodeChallenge(verifier)` / `generatePkcePair(length?)` | PKCE helpers on Web Crypto. `generatePkcePair` → `{ codeVerifier, codeChallenge, codeChallengeMethod: 'S256' }` |
| `buildAuthorizationUrl(params)` | Builds the URL (`response_type=code`, `S256`). Generates `state` if you don't pass one. → `{ url, state }` |
| `exchangeCodeForToken(params)` | Form-urlencoded exchange against a real token endpoint. Params: `{ tokenEndpoint, clientId, redirectUri, code, codeVerifier, clientSecret? }`. Throws `ConfidentialClientInBrowserError` if `clientSecret` is set in a browser. → `TokenResponse` |
| `exchangeCodeForTokenViaBackend(params)` | JSON `{ code, code_verifier, redirect_uri }` to your `/token` proxy. Params: `{ tokenProxyEndpoint, code, codeVerifier, redirectUri }`. Throws `ProxyTokenExchangeError` on non-2xx. → `ProxyTokenResponse` |
| `decodeIdToken(params)` | POSTs `{ id_token }` to `decodeEndpoint`. Params: `{ decodeEndpoint, idToken }`. Throws `DecodeError` on non-2xx. → `Claims` |
| `createSession(tokenResponse, claims)` | → `Session` (`accessToken`, `idToken?`, `refreshToken?`, `tokenType?`, `scope?`, `expiresAt: number \| null`, `claims`). |
| `isAuthenticated(session)` / `isExpired(session, skewSeconds?)` / `getAccessToken(session)` / `getClaims(session)` | Session helpers. |

### Errors

All extend `OAuth2Error` (which carries `name`, `message`, and optional
`status` / `body`). Discriminate with `instanceof`.

`DiscoveryError` · `TokenExchangeError` · `ProxyTokenExchangeError` ·
`DecodeError` · `ConfidentialClientInBrowserError`

### Wire vs. native shapes

Types crossing the wire keep snake_case (`TokenResponse.access_token`,
`ProxyTokenResponse.claims`, `OidcConfiguration.token_endpoint`). Library-native
types use camelCase (`Session.accessToken`, `PkcePair.codeVerifier`).

## What you own

`state`, `codeVerifier`, and the `Session` are **not** persisted by the library.
Store `state` + `codeVerifier` (signed cookie, `sessionStorage`, …) before the
redirect and pass them back on the callback. Token storage, refresh rotation,
silent renew, and logout propagation are out of scope.

## Development

```sh
npm test           # vitest run — full suite
npm run test:watch # vitest watch
npm run typecheck  # tsc --noEmit
npm run build      # tsup -> dist/{index.js,index.cjs,index.d.ts}
```

`npm run typecheck` + `npm test` are the full verification gate; there is no
linter.

## License

MIT
