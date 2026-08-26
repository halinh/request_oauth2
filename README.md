# request-oauth2

Isomorphic TypeScript client for the OIDC/OAuth2 `authorization_code` + PKCE
flow. It fetches an OIDC well-known discovery document, builds an
authorization URL, exchanges an authorization code for tokens, and decodes
the resulting `id_token` by POSTing it to a backend endpoint you control
(the library never decodes the token itself).

Works in both Node.js (18+) and the browser (e.g. React client components) —
it only uses the global `fetch` and Web Crypto APIs, with zero runtime
dependencies.

## Install

```sh
npm install request-oauth2
```

## Security note

A `client_secret` (confidential client) must never be used from browser
code — it would ship inside your JS bundle for anyone to read. This library
always supports PKCE (`code_verifier` / `code_challenge`) for the
authorization and token-exchange steps, and it will **throw** if
`clientSecret` is passed while running in a browser (`typeof window !==
'undefined'`) — before making any network call. If you need a confidential
exchange, perform it server-side, or proxy it through your own backend.

## Node server example

```ts
import { createOidcClient } from 'request-oauth2';

const client = createOidcClient({
  wellKnownUrl: 'https://idp.example.com/.well-known/openid-configuration',
  clientId: process.env.OIDC_CLIENT_ID!,
  clientSecret: process.env.OIDC_CLIENT_SECRET, // server-side only
  redirectUri: 'https://app.example.com/callback',
  scope: 'openid profile email',
  decodeEndpoint: 'https://backend.example.com/decode',
});

// GET /login
app.get('/login', async (req, res) => {
  const { url, state, codeVerifier } = await client.startAuthorization();
  // Persist state + codeVerifier across the redirect round-trip, e.g. a signed cookie.
  req.session.oauth = { state, codeVerifier };
  res.redirect(url);
});

// GET /callback?code=...&state=...
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (state !== req.session.oauth.state) {
    return res.status(400).send('state mismatch');
  }
  const session = await client.authenticate(code, req.session.oauth.codeVerifier);
  req.session.user = session; // now certified
  res.redirect('/');
});
```

## React client-side example (PKCE only, no secret)

The token exchange needs `client_secret` in most confidential setups, so
from the browser you redirect with PKCE and then hand the `code` +
`codeVerifier` to your own backend, which performs the exchange
server-side.

```tsx
import { generatePkcePair, buildAuthorizationUrl } from 'request-oauth2';

async function login() {
  const oidc = await fetch('https://idp.example.com/.well-known/openid-configuration').then((r) => r.json());
  const pkce = await generatePkcePair();
  sessionStorage.setItem('codeVerifier', pkce.codeVerifier);

  const { url } = buildAuthorizationUrl({
    authorizationEndpoint: oidc.authorization_endpoint,
    clientId: 'my-public-client',
    redirectUri: 'https://app.example.com/callback',
    scope: 'openid profile email',
    codeChallenge: pkce.codeChallenge,
  });
  window.location.href = url;
}

// On the /callback page:
async function handleCallback(code: string) {
  const codeVerifier = sessionStorage.getItem('codeVerifier')!;
  // Your own backend route performs exchangeCodeForToken + decodeIdToken server-side
  // and returns/stores the resulting session (e.g. as an HTTP-only cookie).
  await fetch('/api/oauth/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier }),
  });
}
```

## API reference

| Export | Description |
| --- | --- |
| `createOidcClient(config)` | Factory combining discovery, PKCE, token exchange, decode, and session creation. Returns `{ startAuthorization, exchangeCodeForToken, decodeIdToken, createSession, authenticate }`. |
| `fetchOidcConfiguration(wellKnownUrl)` | Fetches and parses the OIDC discovery document. |
| `generateCodeVerifier() / generateCodeChallenge() / generatePkcePair()` | PKCE helpers built on Web Crypto. |
| `buildAuthorizationUrl(params)` | Builds an authorization URL; `codeChallenge` is required. |
| `exchangeCodeForToken(params)` | Exchanges an authorization code for tokens. Throws `ConfidentialClientInBrowserError` if `clientSecret` is used in a browser. |
| `decodeIdToken(params)` | POSTs the `id_token` to your `decodeEndpoint` and returns the decoded claims. |
| `createSession(tokenResponse, claims)` | Builds an in-memory `Session` (tokens + expiry + claims). |
| `isAuthenticated(session)` / `isExpired(session)` / `getAccessToken(session)` / `getClaims(session)` | Session helper functions. |
| `OAuth2Error` and subclasses | `DiscoveryError`, `TokenExchangeError`, `DecodeError`, `ConfidentialClientInBrowserError`. |

Note: `state` and `codeVerifier` returned by `startAuthorization()` are not
persisted by the library — you're responsible for storing them (cookie,
`sessionStorage`, etc.) across the redirect round-trip and passing them back
in on the callback.

## License

MIT
