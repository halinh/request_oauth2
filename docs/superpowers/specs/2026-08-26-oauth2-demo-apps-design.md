# OAuth2 demo apps: local packaging + client-side & server-side use cases

Date: 2026-08-26

## Goal

Make `request-oauth2` installable locally via npm, and build two demo apps
that each exercise one of the library's two supported usage patterns:

- **react-login** — the *client-side* (public client, PKCE-only) use case.
- **next-login** — the *server-side* (confidential client, `client_secret`)
  use case.

Both demos need a running OIDC identity provider and a `decodeEndpoint` to
POST `id_token`s to (per the library's design — it never decodes tokens
itself). Two small shared services are added for that, so the two demo apps
stay focused on demonstrating `request-oauth2` rather than reimplementing
IdP/decoding plumbing.

## Final project layout

All five projects are siblings under `/mnt/d/Example/`:

```
request_oauth2/       existing library — no functional changes
mock-oidc-provider/   new — minimal OIDC IdP (Node/Express/TS)
decode-service/        new — minimal JWT decode endpoint (FastAPI/Python)
react-login/           new — Vite + React demo (client-side use case)
next-login/            new — Next.js demo (server-side use case)
```

Both `react-login` and `next-login` depend on the library via:

```json
"request-oauth2": "file:../request_oauth2"
```

## 1. request_oauth2 — local packaging

No code changes. The package already has a correct `dist/` build, `exports`
map, and `files: ["dist"]`. Verification only:

1. `npm run build` — confirm clean build.
2. `npm pack --dry-run` — confirm the tarball would contain exactly `dist/`
   + `package.json` + `README.md` (no `src/`, `test/`, config files).

`file:` dependents (react-login, next-login) resolve directly against this
directory; no publish step needed for local use.

## 2. mock-oidc-provider — shared mock IdP

Node + Express + TypeScript, run with `tsx` in dev.

**Endpoints:**

- `GET /.well-known/openid-configuration` — discovery document
  (`authorization_endpoint`, `token_endpoint`, `issuer`).
- `GET /authorize` — reads `response_type`, `client_id`, `redirect_uri`,
  `scope`, `state`, `code_challenge`, `code_challenge_method`. Renders a
  minimal HTML page with a single "Login as demo user" button (no real
  credential entry — this is a mock). On submit, generates an authorization
  `code`, stores it in memory keyed to `{ client_id, redirect_uri,
  code_challenge }`, redirects to `redirect_uri?code=...&state=...`.
- `POST /token` — `application/x-www-form-urlencoded`,
  `grant_type=authorization_code`. Looks up the stored code:
  - Public client (`react-login-public`): validates PKCE
    (`code_verifier` against stored `code_challenge`, S256).
  - Confidential client (`next-login-confidential`): validates
    `client_secret` instead.
  - On success, issues `access_token` (opaque random string) and a real
    signed `id_token` (JWT, HS256, dev-only shared secret, via `jose`) with
    `sub`, `email`, `name`, `iat`, `exp` claims. Deletes the code (single
    use).
- CORS: enabled on `/token` and `/.well-known/openid-configuration` for the
  Vite dev origin (`http://localhost:5173`), since react-login calls
  `/token` directly from the browser. `/authorize` is a normal top-level
  navigation, no CORS needed.

**Registered clients (hardcoded in this service's config):**

| client_id | type | secret |
| --- | --- | --- |
| `react-login-public` | public | none — PKCE required |
| `next-login-confidential` | confidential | dev-only static secret |

**State:** in-memory `Map`, single process, resets on restart. No database.

## 3. decode-service — shared decode endpoint

FastAPI (Python), single route:

- `POST /decode` — body `{ "id_token": "<jwt>" }`. Verifies the JWT
  signature with `PyJWT` against the same HS256 dev secret used by
  `mock-oidc-provider`, returns the decoded claims as JSON. Invalid/expired
  token → `400` with an error body.
- CORS: enabled for `http://localhost:5173` (react-login calls it directly
  from the browser). next-login calls it server-to-server, no CORS needed
  for that caller but leaving CORS open doesn't hurt.

This service does **not** and cannot use the `request-oauth2` npm package
(it's TypeScript-only) — its decode logic is an independent Python
implementation of the same POST-body contract the library's `decodeIdToken`
expects.

Both demo apps point their `decodeEndpoint` config at this one running
instance (e.g. `http://localhost:8000/decode`).

## 4. react-login — client-side use case

Vite + React + TypeScript. No backend of its own.

**Flow**, entirely in the browser, as a **public** client (no
`clientSecret` anywhere in this app):

1. `/` — "Login" button. On click: `generatePkcePair()` +
   `buildAuthorizationUrl()` from `request-oauth2` build the authorize URL
   against `mock-oidc-provider`. `state` + `codeVerifier` are stashed in
   `sessionStorage`. Browser navigates to the authorize URL.
2. `/callback` — reads `code` + `state` from the query string, checks
   `state` against the stored value (mismatch → error view). Calls
   `exchangeCodeForToken()` directly against `mock-oidc-provider`'s
   `/token` (safe in-browser: public client, no secret). Calls
   `decodeIdToken()`, which POSTs the `id_token` to `decode-service`.
   Builds a `Session` via `createSession()`.
3. Session (claims + tokens) is kept in React state and mirrored to
   `sessionStorage` so a page refresh doesn't lose it. `/` then shows the
   logged-in profile (claims) and a "Logout" button that clears storage.

**Config** (`.env` / `.env.example`):

```
VITE_OIDC_WELL_KNOWN_URL=http://localhost:4000/.well-known/openid-configuration
VITE_OIDC_CLIENT_ID=react-login-public
VITE_OIDC_REDIRECT_URI=http://localhost:5173/callback
VITE_OIDC_SCOPE=openid profile email
VITE_DECODE_ENDPOINT=http://localhost:8000/decode
```

**Error handling:** state mismatch, discovery failure, token-exchange
failure, and decode failure each render a distinct error message on
`/callback` using the thrown `OAuth2Error` subclass's `.message`.

**Testing:** none added for this app — it's a demo consuming an already-
tested library. Verified manually end-to-end (login → callback → claims
shown) once implemented, with `mock-oidc-provider` and `decode-service`
running locally.

## 5. next-login — server-side use case

Next.js (App Router) + TypeScript. Confidential client
(`next-login-confidential`, with `client_secret`) — the true server-side
flow, matching the library README's Node example.

**Route handlers:**

- `GET /login` — calls `client.startAuthorization()`. Stores `{ state,
  codeVerifier }` as JSON in an httpOnly cookie. Redirects to the
  authorize URL.
- `GET /callback` — reads `code` + `state` from the query string, compares
  `state` to the cookie (mismatch → 400). Calls
  `client.authenticate(code, codeVerifier)` — this internally calls
  `exchangeCodeForToken` (with `clientSecret`, safe server-side against
  `mock-oidc-provider`) and `decodeIdToken`, which POSTs the `id_token`
  server-to-server to the shared `decode-service` (no route of next-login's
  own does this). On success, stores the resulting session (tokens +
  claims) as JSON in a new httpOnly cookie, clears the temporary
  state/verifier cookie, redirects to `/`.
- `GET /logout` — clears the session cookie, redirects to `/`.
- `/` — Server Component. Reads the session cookie; if present, renders the
  claims and a logout link; if absent, renders a login link.

Session and state/verifier cookies are httpOnly + `sameSite=lax` but store
plain JSON — not signed or encrypted. Acceptable for a local demo against a
mock IdP; a real deployment would sign or encrypt these instead.

**Config** (`.env.local` / `.env.example`):

```
OIDC_WELL_KNOWN_URL=http://localhost:4000/.well-known/openid-configuration
OIDC_CLIENT_ID=next-login-confidential
OIDC_CLIENT_SECRET=dev-only-static-secret
OIDC_REDIRECT_URI=http://localhost:3000/callback
OIDC_SCOPE=openid profile email
DECODE_ENDPOINT=http://localhost:8000/decode
```

**Error handling:** state mismatch and any `OAuth2Error` thrown during
`authenticate()` render a simple error page with the message.

**Testing:** none added, same rationale as react-login — verified manually
end-to-end once implemented.

## Shared dev constants

These exact literal values are used verbatim across `mock-oidc-provider`,
`decode-service`, and `next-login` — they must match byte-for-byte since
`decode-service` verifies JWTs signed by `mock-oidc-provider`, and
`next-login` authenticates as the confidential client `mock-oidc-provider`
registers.

| Constant | Value |
| --- | --- |
| JWT signing secret (HS256), env var `JWT_DEV_SECRET` on both `mock-oidc-provider` and `decode-service` | `dev-only-insecure-shared-secret-do-not-use-in-prod` |
| Confidential client secret, env var `OIDC_CLIENT_SECRET` on `next-login`, hardcoded as `next-login-confidential`'s secret in `mock-oidc-provider` | `next-login-dev-secret-do-not-use-in-prod` |

## Ports (local dev)

| Service | Port |
| --- | --- |
| mock-oidc-provider | 4000 |
| decode-service | 8000 |
| react-login (Vite) | 5173 |
| next-login | 3000 |

## Out of scope

- Publishing `request-oauth2` to the public npm registry.
- Real credential entry / user database in `mock-oidc-provider` — it's a
  single-click mock login.
- Persistent storage anywhere (all state is in-memory or in cookies).
- Automated tests for the four new projects.
- HTTPS / production deployment concerns for any of the demos.
