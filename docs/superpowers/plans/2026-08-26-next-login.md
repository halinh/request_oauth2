# next-login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `next-login`, a Next.js (App Router) demo app that exercises `request-oauth2`'s server-side / confidential-client authorization_code flow end-to-end against `mock-oidc-provider` and `decode-service`.

**Architecture:** Three route handlers (`GET /login`, `GET /callback`, `GET /logout`) drive the OAuth2 round trip using a single server-side `OidcClient` instance from `request-oauth2`, storing the transient `{ state, codeVerifier }` pair and the final `Session` as httpOnly JSON cookies. A `/` Server Component reads the session cookie via `next/headers` and renders either the decoded claims or a login link. No client-side JavaScript, no API routes beyond the three above, and no `/api/decode` route — decoding happens inside the library's `authenticate()` call, which POSTs server-to-server to the shared `decode-service`.

**Tech Stack:** Next.js (App Router), React, TypeScript, `request-oauth2` (installed as a `file:` dependency).

**Spec:** /mnt/d/Example/request_oauth2/docs/superpowers/specs/2026-08-26-oauth2-demo-apps-design.md

## Global Constraints

- Port: next-login runs on **3000** (Next.js default).
- Env vars (exact names, from `.env.local` / `.env.example`):
  ```
  OIDC_WELL_KNOWN_URL=http://localhost:4000/.well-known/openid-configuration
  OIDC_CLIENT_ID=next-login-confidential
  OIDC_CLIENT_SECRET=next-login-dev-secret-do-not-use-in-prod
  OIDC_REDIRECT_URI=http://localhost:3000/callback
  OIDC_SCOPE=openid profile email
  DECODE_ENDPOINT=http://localhost:8000/decode
  ```
  `OIDC_CLIENT_SECRET` is the exact literal dev constant from the spec's "Shared dev constants" table — it must match byte-for-byte what `mock-oidc-provider` registers for `next-login-confidential`.
- Cookies: two httpOnly, `sameSite=lax` cookies, storing **plain unsigned JSON** (dev-only, explicitly not signed/encrypted per spec):
  - `oauth_state` — temporary `{ state, codeVerifier }`, set by `/login`, read + cleared by `/callback`.
  - `session` — the `Session` object returned by `authenticate()`, set by `/callback`, read by `/`, cleared by `/logout`.
- **next-login MUST NOT have an `/api/decode` route or any decoding route of its own.** Decoding is handled entirely inside `request-oauth2`'s `authenticate()` (which calls `decodeIdToken()` against the shared `decode-service`). This app only ever calls the library — it never talks to `decode-service` directly.
- No automated tests for this project. Every verification step is either "run `npm run build` and confirm no TypeScript errors" or an exact manual browser/curl step.
- `request-oauth2` is installed as `"request-oauth2": "file:../request_oauth2"` (local sibling directory, not the public registry).

---

### Task 1: Scaffold next-login, install request-oauth2, shared config module

**Files:**
- Create: `/mnt/d/Example/next-login/` (via `create-next-app`)
- Create: `/mnt/d/Example/next-login/.env.example`
- Create: `/mnt/d/Example/next-login/.env.local`
- Create: `/mnt/d/Example/next-login/lib/oidcClient.ts`
- Create: `/mnt/d/Example/next-login/lib/cookies.ts`
- Modify: `/mnt/d/Example/next-login/README.md`
- Modify: `/mnt/d/Example/next-login/package.json` (via `npm install`)

**Interfaces:**
- Consumes: `createOidcClient(config: OidcClientConfig)` from `request-oauth2`, returning `OidcClient` (`{ startAuthorization, exchangeCodeForToken, decodeIdToken, createSession, authenticate }`).
- Produces: `oidcClient` singleton exported from `lib/oidcClient.ts` (used by Tasks 2 and 3). `OAUTH_STATE_COOKIE`, `SESSION_COOKIE` constants, `OAuthStateCookie` type, and `parseOAuthStateCookie` / `parseSessionCookie` helpers exported from `lib/cookies.ts` (used by Tasks 2, 3, 4, 5).

- [ ] **Step 1: Confirm the library has a build to link against**
  Run:
  ```bash
  cd /mnt/d/Example/request_oauth2 && ls dist/ 2>/dev/null || npm run build
  ```
  Confirm the command exits 0 and `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` exist (`ls dist/`). `next-login`'s `file:` dependency resolves against this directory, so a missing/stale build would break the install in Step 3.

- [ ] **Step 2: Scaffold the Next.js app**
  Run from `/mnt/d/Example` (NOT from inside `request_oauth2`):
  ```bash
  cd /mnt/d/Example && npx create-next-app@latest next-login --typescript --app --no-tailwind --no-eslint --src-dir=false --import-alias "@/*"
  ```
  Answer any interactive prompts with defaults if prompted (Turbopack default is fine either way). Confirm the command finishes and `/mnt/d/Example/next-login/package.json`, `/mnt/d/Example/next-login/app/page.tsx` exist.

- [ ] **Step 3: Ensure the project is a git repo**
  `create-next-app` usually runs `git init` and an initial commit itself. Verify rather than assume:
  ```bash
  cd /mnt/d/Example/next-login && git status
  ```
  - If this prints repo status (not "not a git repository"), a repo already exists — do nothing further here.
  - If it errors with "not a git repository", initialize one:
    ```bash
    cd /mnt/d/Example/next-login && git init
    ```

- [ ] **Step 4: Install request-oauth2 as a file: dependency**
  ```bash
  cd /mnt/d/Example/next-login && npm install ../request_oauth2
  ```
  Confirm `/mnt/d/Example/next-login/package.json` now contains a dependency line reading exactly:
  ```json
  "request-oauth2": "file:../request_oauth2"
  ```
  (Check with `grep request-oauth2 package.json`.)

- [ ] **Step 5: Create `.env.example`**
  Create `/mnt/d/Example/next-login/.env.example`:
  ```
  OIDC_WELL_KNOWN_URL=http://localhost:4000/.well-known/openid-configuration
  OIDC_CLIENT_ID=next-login-confidential
  OIDC_CLIENT_SECRET=next-login-dev-secret-do-not-use-in-prod
  OIDC_REDIRECT_URI=http://localhost:3000/callback
  OIDC_SCOPE=openid profile email
  DECODE_ENDPOINT=http://localhost:8000/decode
  ```

- [ ] **Step 6: Create `.env.local` with the same values**
  Create `/mnt/d/Example/next-login/.env.local` with identical content to `.env.example` above (this is the file Next.js actually loads at runtime; it must exist for `npm run dev` / `npm run build` to have the env vars available).

- [ ] **Step 7: Force-track `.env.example` despite the default `.gitignore`**
  `create-next-app`'s generated `.gitignore` contains a blanket `.env*` line, which would also exclude `.env.example` (it must NOT exclude `.env.local`, which holds no real secrets here but should stay untracked by convention). Confirm this with:
  ```bash
  cd /mnt/d/Example/next-login && grep -n '^\.env' .gitignore
  ```
  Leave `.gitignore` as generated (so `.env.local` stays untracked), and explicitly force-add `.env.example` when committing in Step 10 with `git add -f .env.example`.

- [ ] **Step 8: Create `lib/cookies.ts`**
  Create `/mnt/d/Example/next-login/lib/cookies.ts`:
  ```ts
  import type { Session } from 'request-oauth2';

  /**
   * Name of the httpOnly cookie that holds the temporary { state, codeVerifier }
   * pair between GET /login and GET /callback.
   */
  export const OAUTH_STATE_COOKIE = 'oauth_state';

  /**
   * Name of the httpOnly cookie that holds the authenticated Session
   * (tokens + claims) as JSON, once /callback has completed successfully.
   */
  export const SESSION_COOKIE = 'session';

  export interface OAuthStateCookie {
    state: string;
    codeVerifier: string;
  }

  /** Parses the raw oauth_state cookie value. Returns null if missing or malformed. */
  export function parseOAuthStateCookie(raw: string | undefined): OAuthStateCookie | null {
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as OAuthStateCookie;
    } catch {
      return null;
    }
  }

  /** Parses the raw session cookie value. Returns null if missing or malformed. */
  export function parseSessionCookie(raw: string | undefined): Session | null {
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }
  ```

- [ ] **Step 9: Create `lib/oidcClient.ts`**
  Create `/mnt/d/Example/next-login/lib/oidcClient.ts`:
  ```ts
  import { createOidcClient } from 'request-oauth2';
  import type { OidcClient } from 'request-oauth2';

  function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  }

  // Confidential client: clientSecret is set, so this module must never be
  // imported from client-side code. It is only imported by Route Handlers
  // (app/login/route.ts, app/callback/route.ts) which always run on the server.
  export const oidcClient: OidcClient = createOidcClient({
    wellKnownUrl: requiredEnv('OIDC_WELL_KNOWN_URL'),
    clientId: requiredEnv('OIDC_CLIENT_ID'),
    clientSecret: requiredEnv('OIDC_CLIENT_SECRET'),
    redirectUri: requiredEnv('OIDC_REDIRECT_URI'),
    scope: requiredEnv('OIDC_SCOPE'),
    decodeEndpoint: requiredEnv('DECODE_ENDPOINT'),
  });
  ```

- [ ] **Step 10: Write `README.md`**
  Overwrite `/mnt/d/Example/next-login/README.md`:
  ```markdown
  # next-login

  Next.js (App Router) demo of `request-oauth2`'s server-side, confidential-client
  authorization_code flow (with `client_secret`).

  ## Prerequisites

  Two sibling services must be running before you use this app:

  - `mock-oidc-provider` on `http://localhost:4000`
  - `decode-service` on `http://localhost:8000`

  This app never calls `decode-service` directly — `request-oauth2`'s
  `authenticate()` call does that server-to-server internally. There is no
  `/api/decode` route in this app.

  ## Setup

  ```bash
  npm install
  cp .env.example .env.local   # already present in this repo checkout; edit if your
                                 # mock-oidc-provider / decode-service run on different ports
  ```

  ## Run

  ```bash
  npm run dev
  ```

  Then open http://localhost:3000, click "Log in", and complete the mock
  login page served by `mock-oidc-provider`.

  ## Routes

  - `GET /login` — starts the authorization flow, redirects to the IdP.
  - `GET /callback` — completes the flow, sets the session cookie, redirects to `/`.
  - `GET /logout` — clears the session cookie, redirects to `/`.
  - `/` — shows decoded claims when logged in, or a login link when not.
  ```

- [ ] **Step 11: Verify the build**
  ```bash
  cd /mnt/d/Example/next-login && npm run build
  ```
  Confirm it completes with no TypeScript errors (the default Next.js starter pages/build must succeed even though `app/login`, `app/callback`, `app/logout` don't exist yet — this only verifies scaffolding + `lib/` compile cleanly).

- [ ] **Step 12: Commit**
  ```bash
  cd /mnt/d/Example/next-login
  git add -f .env.example
  git add -A
  git status
  ```
  Confirm `git status` shows `.env.example` staged and `.env.local` NOT staged (it must stay untracked — it's covered by the default `.env*` gitignore rule and is where any real local secret values would live). Then commit:
  ```bash
  git commit -m "chore: scaffold next-login, install request-oauth2, add oidc client config"
  ```

---

### Task 2: `GET /login` route handler

**Files:**
- Create: `/mnt/d/Example/next-login/app/login/route.ts`

**Interfaces:**
- Consumes: `oidcClient.startAuthorization(overrides?)` (Task 1) → `Promise<AuthorizationUrlResult>` where `AuthorizationUrlResult = { url: string; state: string; codeVerifier: string }`. `OAUTH_STATE_COOKIE`, `OAuthStateCookie` (Task 1).
- Produces: sets the `oauth_state` cookie consumed by `/callback` (Task 3).

- [ ] **Step 1: Create the route handler**
  Create `/mnt/d/Example/next-login/app/login/route.ts`:
  ```ts
  import { NextResponse } from 'next/server';
  import { oidcClient } from '@/lib/oidcClient';
  import { OAUTH_STATE_COOKIE, type OAuthStateCookie } from '@/lib/cookies';

  export async function GET(): Promise<NextResponse> {
    const { url, state, codeVerifier } = await oidcClient.startAuthorization();

    const response = NextResponse.redirect(url);

    const cookiePayload: OAuthStateCookie = { state, codeVerifier };
    response.cookies.set(OAUTH_STATE_COOKIE, JSON.stringify(cookiePayload), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes: enough for the IdP redirect round-trip, short-lived by design
    });

    return response;
  }
  ```

- [ ] **Step 2: Verify the build**
  ```bash
  cd /mnt/d/Example/next-login && npm run build
  ```
  Confirm no TypeScript errors.

- [ ] **Step 3: Manual verification (requires mock-oidc-provider running on :4000)**
  With `mock-oidc-provider` running (see Task 6 for exact start command) and `npm run dev` running for next-login:
  ```bash
  curl -si http://localhost:3000/login | head -n 20
  ```
  Confirm the response is a `307`/`302` redirect whose `Location` header points at `http://localhost:4000/authorize?...` with `client_id=next-login-confidential`, `code_challenge=...`, `state=...`, and confirm a `Set-Cookie: oauth_state=...; HttpOnly; SameSite=Lax` header is present.

- [ ] **Step 4: Commit**
  ```bash
  cd /mnt/d/Example/next-login
  git add app/login/route.ts
  git commit -m "feat(next-login): add GET /login route handler"
  ```

---

### Task 3: `GET /callback` route handler

**Files:**
- Create: `/mnt/d/Example/next-login/app/callback/route.ts`

**Interfaces:**
- Consumes: `oidcClient.authenticate(code, codeVerifier)` (Task 1) → `Promise<Session>`; `OAuth2Error` from `request-oauth2` (base class of `DiscoveryError`, `TokenExchangeError`, `DecodeError`, `ConfidentialClientInBrowserError`); `OAUTH_STATE_COOKIE`, `SESSION_COOKIE`, `parseOAuthStateCookie` (Task 1).
- Produces: sets the `session` cookie (JSON-serialized `Session`) consumed by `/` (Task 5); clears `oauth_state`.

- [ ] **Step 1: Create the route handler**
  Create `/mnt/d/Example/next-login/app/callback/route.ts`:
  ```ts
  import { NextResponse, type NextRequest } from 'next/server';
  import { OAuth2Error } from 'request-oauth2';
  import { oidcClient } from '@/lib/oidcClient';
  import { OAUTH_STATE_COOKIE, SESSION_COOKIE, parseOAuthStateCookie } from '@/lib/cookies';

  function errorPage(message: string, status: number): NextResponse {
    const html = `<!doctype html>
  <html>
    <head><title>Authentication error</title></head>
    <body>
      <h1>Authentication error</h1>
      <p>${message}</p>
      <p><a href="/">Back to home</a></p>
    </body>
  </html>`;
    return new NextResponse(html, {
      status,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  export async function GET(request: NextRequest): Promise<NextResponse> {
    const code = request.nextUrl.searchParams.get('code');
    const returnedState = request.nextUrl.searchParams.get('state');

    if (!code || !returnedState) {
      return errorPage('Missing code or state query parameter.', 400);
    }

    const storedState = parseOAuthStateCookie(request.cookies.get(OAUTH_STATE_COOKIE)?.value);
    if (!storedState) {
      return errorPage(
        'Missing or malformed oauth_state cookie; the login flow may have expired. Please try logging in again.',
        400,
      );
    }

    if (returnedState !== storedState.state) {
      return errorPage(
        'State mismatch: the state returned by the identity provider does not match the value stored before redirecting.',
        400,
      );
    }

    try {
      const session = await oidcClient.authenticate(code, storedState.codeVerifier);

      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.set(SESSION_COOKIE, JSON.stringify(session), {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });
      response.cookies.delete(OAUTH_STATE_COOKIE);
      return response;
    } catch (error) {
      if (error instanceof OAuth2Error) {
        return errorPage(`${error.name}: ${error.message}`, error.status ?? 502);
      }
      return errorPage('Unexpected error during authentication.', 500);
    }
  }
  ```

- [ ] **Step 2: Verify the build**
  ```bash
  cd /mnt/d/Example/next-login && npm run build
  ```
  Confirm no TypeScript errors.

- [ ] **Step 3: Manual verification — state mismatch (requires next-login running, no other services needed)**
  With `npm run dev` running:
  ```bash
  curl -si "http://localhost:3000/callback?code=fake&state=wrong-state" \
    --cookie "oauth_state=%7B%22state%22%3A%22real-state%22%2C%22codeVerifier%22%3A%22abc%22%7D"
  ```
  Confirm a `400` response whose body contains "State mismatch".

- [ ] **Step 4: Manual verification — happy path (requires mock-oidc-provider on :4000 and decode-service on :8000, see Task 6)**
  In a browser, visit `http://localhost:3000/login`, click through the mock IdP's "Login as demo user" button. Confirm the browser lands back on `http://localhost:3000/` with a `session` cookie set (check via browser devtools → Application → Cookies: `session` present, `HttpOnly` checked, `oauth_state` absent).

- [ ] **Step 5: Commit**
  ```bash
  cd /mnt/d/Example/next-login
  git add app/callback/route.ts
  git commit -m "feat(next-login): add GET /callback route handler"
  ```

---

### Task 4: `GET /logout` route handler

**Files:**
- Create: `/mnt/d/Example/next-login/app/logout/route.ts`

**Interfaces:**
- Consumes: `SESSION_COOKIE` (Task 1).
- Produces: clears the `session` cookie.

- [ ] **Step 1: Create the route handler**
  Create `/mnt/d/Example/next-login/app/logout/route.ts`:
  ```ts
  import { NextResponse } from 'next/server';
  import { SESSION_COOKIE } from '@/lib/cookies';

  export async function GET(request: Request): Promise<NextResponse> {
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }
  ```

- [ ] **Step 2: Verify the build**
  ```bash
  cd /mnt/d/Example/next-login && npm run build
  ```
  Confirm no TypeScript errors.

- [ ] **Step 3: Manual verification (requires next-login running; a prior successful login from Task 3 Step 4 is the easiest way to have a session cookie set, but this also works standalone)**
  ```bash
  curl -si http://localhost:3000/logout --cookie "session=%7B%22accessToken%22%3A%22x%22%7D"
  ```
  Confirm a `307`/`302` redirect to `/` and a `Set-Cookie: session=;` header with an expiry in the past (i.e. the cookie is being cleared).

- [ ] **Step 4: Commit**
  ```bash
  cd /mnt/d/Example/next-login
  git add app/logout/route.ts
  git commit -m "feat(next-login): add GET /logout route handler"
  ```

---

### Task 5: `/` Server Component

**Files:**
- Modify: `/mnt/d/Example/next-login/app/page.tsx` (replace the create-next-app default content)

**Interfaces:**
- Consumes: `SESSION_COOKIE`, `parseSessionCookie` (Task 1); `cookies()` from `next/headers`; `Session` type from `request-oauth2`.
- Produces: the `/` page used as the redirect target of `/callback` (Task 3) and `/logout` (Task 4), and as the entry point linking to `/login` (Task 2).

- [ ] **Step 1: Replace `app/page.tsx`**
  Overwrite `/mnt/d/Example/next-login/app/page.tsx`:
  ```tsx
  import { cookies } from 'next/headers';
  import { SESSION_COOKIE, parseSessionCookie } from '@/lib/cookies';

  export default async function HomePage() {
    const cookieStore = await cookies();
    const session = parseSessionCookie(cookieStore.get(SESSION_COOKIE)?.value);

    if (!session) {
      return (
        <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
          <h1>next-login demo</h1>
          <p>You are not logged in.</p>
          <a href="/login">Log in</a>
        </main>
      );
    }

    return (
      <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
        <h1>next-login demo</h1>
        <p>You are logged in.</p>
        <pre style={{ background: '#f0f0f0', padding: '1rem' }}>
          {JSON.stringify(session.claims, null, 2)}
        </pre>
        <a href="/logout">Log out</a>
      </main>
    );
  }
  ```

- [ ] **Step 2: Verify the build**
  ```bash
  cd /mnt/d/Example/next-login && npm run build
  ```
  Confirm no TypeScript errors.

- [ ] **Step 3: Manual verification — logged out state (requires next-login running, no other services needed)**
  ```bash
  curl -s http://localhost:3000/ | grep -o 'You are not logged in\|Log in'
  ```
  Confirm both strings are present (no `session` cookie sent).

- [ ] **Step 4: Manual verification — logged in state**
  After completing Task 3 Step 4's browser login, reload `http://localhost:3000/` in the same browser. Confirm the page shows "You are logged in.", a `<pre>` block with `sub`, `email`, `name` claims from the mock IdP's `id_token`, and a "Log out" link.

- [ ] **Step 5: Commit**
  ```bash
  cd /mnt/d/Example/next-login
  git add app/page.tsx
  git commit -m "feat(next-login): render session claims or login link on /"
  ```

---

### Task 6: Full end-to-end manual verification

**Files:** none (verification only — no source changes in this task).

**Interfaces:**
- Consumes: everything from Tasks 1–5, plus the running `mock-oidc-provider` and `decode-service` sibling services.
- Produces: n/a.

- [ ] **Step 1: Start the two dependency services**
  These must both be running before this task's checks. In two separate terminals:
  ```bash
  cd /mnt/d/Example/mock-oidc-provider && npm run dev
  ```
  Confirm it logs that it is listening on port **4000**. (Exact script name comes from that project's own plan — per the design spec it's "Node + Express + TypeScript, run with tsx in dev"; if `npm run dev` doesn't exist, check `mock-oidc-provider/package.json` for the equivalent script, e.g. `tsx watch src/index.ts`.)
  ```bash
  cd /mnt/d/Example/decode-service && uvicorn main:app --reload --port 8000
  ```
  Confirm it logs that it is listening on port **8000**. (Exact module path comes from that project's own plan — per the design spec it's a FastAPI app exposing `POST /decode`; if `main:app` doesn't resolve, check `decode-service`'s entry-point file for the correct `<module>:<app>` target.)

- [ ] **Step 2: Sanity-check both dependency services directly**
  ```bash
  curl -s http://localhost:4000/.well-known/openid-configuration
  ```
  Confirm JSON containing `authorization_endpoint` and `token_endpoint` fields.
  ```bash
  curl -si -X POST http://localhost:8000/decode -H 'Content-Type: application/json' -d '{"id_token":"not-a-real-jwt"}'
  ```
  Confirm a `400` response (proves the endpoint is up and rejecting invalid tokens, per spec).

- [ ] **Step 3: Start next-login**
  ```bash
  cd /mnt/d/Example/next-login && npm run dev
  ```
  Confirm it logs that it is listening on port **3000**.

- [ ] **Step 4: Full browser walkthrough**
  1. Open `http://localhost:3000/`. Confirm "You are not logged in." and a "Log in" link.
  2. Click "Log in". Confirm the browser navigates to `http://localhost:4000/authorize?...` and shows the mock IdP's "Login as demo user" page.
  3. Click "Login as demo user". Confirm the browser is redirected back to `http://localhost:3000/callback?code=...&state=...` and then immediately to `http://localhost:3000/`.
  4. On `http://localhost:3000/`, confirm "You are logged in." is shown along with a claims block containing `sub`, `email`, `name` (the values `decode-service` decoded from the `id_token` signed by `mock-oidc-provider`).
  5. Open browser devtools → Application → Cookies for `localhost:3000`. Confirm a `session` cookie exists (`HttpOnly` checked, `SameSite=Lax`) and `oauth_state` does **not** exist.
  6. Click "Log out". Confirm redirect to `http://localhost:3000/` showing "You are not logged in." again, and that the `session` cookie is gone from devtools.

- [ ] **Step 5: Confirm no decode route exists in next-login**
  ```bash
  curl -si -X POST http://localhost:3000/api/decode -H 'Content-Type: application/json' -d '{"id_token":"x"}'
  ```
  Confirm a `404` (this route must not exist — decoding is handled entirely by the shared `decode-service`, called internally by `request-oauth2`'s `authenticate()`).

  No commit for this task — it changes no files. Mark the task complete once every check in Steps 1–5 passes.
