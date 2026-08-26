# react-login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vite + React + TypeScript demo app that exercises the `request-oauth2` library's client-side (public client, PKCE-only) usage pattern end-to-end in the browser: login redirect, callback, token exchange, claims decode, and a logged-in profile view.

**Architecture:** A two-page single-page app with no backend of its own. `/` shows a Login button (or, once authenticated, the decoded claims and a Logout button); `/callback` handles the OAuth2 redirect. Routing is simple pathname-based branching in `App.tsx` (no router library — only two routes). All OAuth2/OIDC work is delegated to the `request-oauth2` package's standalone functions (`fetchOidcConfiguration`, `generatePkcePair`, `buildAuthorizationUrl`, `exchangeCodeForToken`, `decodeIdToken`, `createSession`); this app never uses `createOidcClient` since that factory's `authenticate()` would need a `clientSecret`-capable, server-side context — here everything runs in the browser as a public client.

**Tech Stack:** Vite, React 18, TypeScript (strict, as scaffolded by `vite@latest --template react-ts`), no router library — plain `window.location.pathname` branching. `request-oauth2` installed as a local `file:` dependency.

**Spec:** /mnt/d/Example/request_oauth2/docs/superpowers/specs/2026-08-26-oauth2-demo-apps-design.md

## Global Constraints

- New project lives at `/mnt/d/Example/react-login`, a sibling of `/mnt/d/Example/request_oauth2`. It is its own git repository (`git init` inside it) — it is **not** part of the `request_oauth2` repo.
- Vite dev server listens on **port 5173** (Vite's default — do not override it).
- Depends on the library via `"request-oauth2": "file:../request_oauth2"` in `package.json`.
- **Public client only** — `clientSecret` must never appear anywhere in this app's code, config, or env files. Only PKCE (`generatePkcePair`/`buildAuthorizationUrl`/`exchangeCodeForToken` without `clientSecret`) is used.
- Env vars (`.env` / `.env.example`), exact names and exact default values:
  ```
  VITE_OIDC_WELL_KNOWN_URL=http://localhost:4000/.well-known/openid-configuration
  VITE_OIDC_CLIENT_ID=react-login-public
  VITE_OIDC_REDIRECT_URI=http://localhost:5173/callback
  VITE_OIDC_SCOPE=openid profile email
  VITE_DECODE_ENDPOINT=http://localhost:8000/decode
  ```
- No automated tests for this project. Every task's verification step is either `npm run build` (confirming no TypeScript errors) for pure logic, or exact manual browser steps (navigate to a URL, click a button, observe the result) for UI/flow behavior.
- Error handling on `/callback` must render a **distinct** message for each failure mode: state mismatch, discovery failure (`DiscoveryError`), token-exchange failure (`TokenExchangeError`), and decode failure (`DecodeError`) — using the thrown `OAuth2Error` subclass's `.message`.

---

### Task 1: Scaffold, dependencies, and environment config

**Files:**
- Create: `/mnt/d/Example/react-login/` (via `npm create vite@latest`, scaffolds `package.json`, `tsconfig*.json`, `.gitignore`, `src/`, `public/`, `index.html`, etc.)
- Create: `/mnt/d/Example/react-login/.env.example`
- Create: `/mnt/d/Example/react-login/.env`
- Create: `/mnt/d/Example/react-login/README.md`
- Modify: `/mnt/d/Example/react-login/package.json` (add `request-oauth2` dependency)
- Modify: `/mnt/d/Example/react-login/.gitignore` (ignore `.env`)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a runnable Vite React TypeScript project at `/mnt/d/Example/react-login`, with `request-oauth2` installed and resolvable via `import ... from 'request-oauth2'`, and the five `VITE_OIDC_*`/`VITE_DECODE_ENDPOINT` env vars available on `import.meta.env` for Task 2 to read.

- [ ] **Step 1: Scaffold the Vite project**
```bash
cd /mnt/d/Example
npm create -y vite@latest react-login -- --template react-ts
```

- [ ] **Step 2: Initialize git**
```bash
cd /mnt/d/Example/react-login
git init
```

- [ ] **Step 3: Install scaffolded dependencies**
```bash
cd /mnt/d/Example/react-login
npm install
```

- [ ] **Step 4: Add `request-oauth2` as a local file dependency**
```bash
cd /mnt/d/Example/react-login
npm install request-oauth2@file:../request_oauth2
```
Expected: `package.json`'s `dependencies` now contains `"request-oauth2": "file:../request_oauth2"`, and `node_modules/request-oauth2` exists (as a symlink or copy resolving to `/mnt/d/Example/request_oauth2`).

- [ ] **Step 5: Create `.env.example`**
Create `/mnt/d/Example/react-login/.env.example` with exactly:
```
VITE_OIDC_WELL_KNOWN_URL=http://localhost:4000/.well-known/openid-configuration
VITE_OIDC_CLIENT_ID=react-login-public
VITE_OIDC_REDIRECT_URI=http://localhost:5173/callback
VITE_OIDC_SCOPE=openid profile email
VITE_DECODE_ENDPOINT=http://localhost:8000/decode
```

- [ ] **Step 6: Create `.env`**
Create `/mnt/d/Example/react-login/.env` with the same content (these local-dev defaults are what the app actually uses; the file is gitignored but the values are known, published dev-only constants, matching `.env.example`):
```
VITE_OIDC_WELL_KNOWN_URL=http://localhost:4000/.well-known/openid-configuration
VITE_OIDC_CLIENT_ID=react-login-public
VITE_OIDC_REDIRECT_URI=http://localhost:5173/callback
VITE_OIDC_SCOPE=openid profile email
VITE_DECODE_ENDPOINT=http://localhost:8000/decode
```

- [ ] **Step 7: Gitignore `.env`**
Append a line to `/mnt/d/Example/react-login/.gitignore` (the file already exists from the Vite scaffold; add this line at the end, keeping the existing content above it):
```
.env
```

- [ ] **Step 8: Create `README.md`**
Create `/mnt/d/Example/react-login/README.md` with exactly:
```markdown
# react-login

Demo app exercising the **client-side (public client, PKCE-only)** usage
pattern of the [`request-oauth2`](../request_oauth2) library. Vite + React +
TypeScript, no backend of its own — the browser talks directly to the mock
identity provider and the decode service.

## Prerequisites

This app needs two other local services running first:

1. **mock-oidc-provider** (issues authorization codes and tokens) — from
   `../mock-oidc-provider`:
   ```sh
   npm run dev
   ```
   Listens on http://localhost:4000.

2. **decode-service** (verifies and decodes the `id_token`) — from
   `../decode-service`:
   ```sh
   source .venv/bin/activate
   uvicorn main:app --reload --port 8000
   ```
   Listens on http://localhost:8000.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:5173, click **Login**, complete the mock login, and
you should land back on `/` with your decoded claims shown.

## Config

See `.env.example` for the required environment variables (already copied
to `.env` with matching local-dev defaults — no edits needed for local
development).
```

- [ ] **Step 9: Verify the scaffold builds**
```bash
cd /mnt/d/Example/react-login
npm run build
```
Expected: exits with status 0, no TypeScript errors, and a `dist/` directory is produced.

- [ ] **Step 10: Commit**
```bash
cd /mnt/d/Example/react-login
git add -A
git commit -m "chore(react-login): scaffold vite app and add request-oauth2 dependency"
```

---

### Task 2: OIDC config module and sessionStorage helpers

**Files:**
- Modify: `/mnt/d/Example/react-login/src/vite-env.d.ts` (type the five env vars)
- Create: `/mnt/d/Example/react-login/src/oidcClient.ts`
- Create: `/mnt/d/Example/react-login/src/storage.ts`

**Interfaces:**
- Consumes: `import.meta.env.VITE_OIDC_WELL_KNOWN_URL` etc. (Task 1's `.env`); `Session` type from `request-oauth2` (`/mnt/d/Example/request_oauth2/src/types.ts`).
- Produces: `oidcConfig: OidcEnvConfig` (exported const, `src/oidcClient.ts`) with fields `wellKnownUrl`, `clientId`, `redirectUri`, `scope`, `decodeEndpoint` — consumed by Task 3, Task 4, Task 5. `AuthRequest` interface and `storeAuthRequest`/`loadAuthRequest`/`clearAuthRequest`/`storeSession`/`loadSession`/`clearSession` functions (`src/storage.ts`) — consumed by Task 3, Task 4, Task 5.

- [ ] **Step 1: Type the Vite env vars**
Replace the contents of `/mnt/d/Example/react-login/src/vite-env.d.ts` with:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OIDC_WELL_KNOWN_URL: string;
  readonly VITE_OIDC_CLIENT_ID: string;
  readonly VITE_OIDC_REDIRECT_URI: string;
  readonly VITE_OIDC_SCOPE: string;
  readonly VITE_DECODE_ENDPOINT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 2: Create `src/oidcClient.ts`**
Create `/mnt/d/Example/react-login/src/oidcClient.ts` with:
```ts
// Centralized environment configuration for the OIDC public client.
// Vite exposes variables prefixed with VITE_ on import.meta.env at build time.
// This app is a public client (PKCE-only): no clientSecret is ever read or stored here.

export interface OidcEnvConfig {
  wellKnownUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  decodeEndpoint: string;
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const oidcConfig: OidcEnvConfig = {
  wellKnownUrl: requireEnv('VITE_OIDC_WELL_KNOWN_URL', import.meta.env.VITE_OIDC_WELL_KNOWN_URL),
  clientId: requireEnv('VITE_OIDC_CLIENT_ID', import.meta.env.VITE_OIDC_CLIENT_ID),
  redirectUri: requireEnv('VITE_OIDC_REDIRECT_URI', import.meta.env.VITE_OIDC_REDIRECT_URI),
  scope: requireEnv('VITE_OIDC_SCOPE', import.meta.env.VITE_OIDC_SCOPE),
  decodeEndpoint: requireEnv('VITE_DECODE_ENDPOINT', import.meta.env.VITE_DECODE_ENDPOINT),
};
```

- [ ] **Step 3: Create `src/storage.ts`**
Create `/mnt/d/Example/react-login/src/storage.ts` with:
```ts
// sessionStorage-backed persistence for the in-flight authorization request
// (state + codeVerifier, needed across the redirect round-trip to the IdP)
// and for the resulting Session (so a page refresh doesn't lose login state).

import type { Session } from 'request-oauth2';

const AUTH_REQUEST_KEY = 'react-login.authRequest';
const SESSION_KEY = 'react-login.session';

export interface AuthRequest {
  state: string;
  codeVerifier: string;
}

export function storeAuthRequest(request: AuthRequest): void {
  sessionStorage.setItem(AUTH_REQUEST_KEY, JSON.stringify(request));
}

export function loadAuthRequest(): AuthRequest | null {
  const raw = sessionStorage.getItem(AUTH_REQUEST_KEY);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as AuthRequest;
}

export function clearAuthRequest(): void {
  sessionStorage.removeItem(AUTH_REQUEST_KEY);
}

export function storeSession(session: Session): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): Session | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as Session;
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
```

- [ ] **Step 4: Verify**
```bash
cd /mnt/d/Example/react-login
npm run build
```
Expected: exits with status 0, no TypeScript errors — confirms `import type { Session } from 'request-oauth2'` resolves correctly against the library's built types, and `import.meta.env.VITE_*` type-checks against the new `ImportMetaEnv` interface.

- [ ] **Step 5: Commit**
```bash
cd /mnt/d/Example/react-login
git add src/vite-env.d.ts src/oidcClient.ts src/storage.ts
git commit -m "feat(react-login): add OIDC env config and sessionStorage helpers"
```

---

### Task 3: Home page — login button (unauthenticated view)

**Files:**
- Create: `/mnt/d/Example/react-login/src/pages/Home.tsx`

**Interfaces:**
- Consumes: `fetchOidcConfiguration(wellKnownUrl: string): Promise<OidcConfiguration>`, `generatePkcePair(): Promise<PkcePair>`, `buildAuthorizationUrl(params: BuildAuthorizationUrlParams): BuildAuthorizationUrlResult` from `request-oauth2`; `oidcConfig` from `../oidcClient` (Task 2); `storeAuthRequest` from `../storage` (Task 2).
- Produces: `Home` component (named export) rendering a Login button. Task 5 fully rewrites this file to add the authenticated profile view — this task's version only covers the unauthenticated (logged-out) path, so build-only verification is used here; the button isn't reachable in a browser yet since routing is wired in Task 5.

- [ ] **Step 1: Create `src/pages/Home.tsx`**
Create `/mnt/d/Example/react-login/src/pages/Home.tsx` with:
```tsx
import { useState } from 'react';
import { buildAuthorizationUrl, fetchOidcConfiguration, generatePkcePair } from 'request-oauth2';
import { oidcConfig } from '../oidcClient';
import { storeAuthRequest } from '../storage';

export function Home() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      const discovery = await fetchOidcConfiguration(oidcConfig.wellKnownUrl);
      const pkce = await generatePkcePair();
      const { url, state } = buildAuthorizationUrl({
        authorizationEndpoint: discovery.authorization_endpoint,
        clientId: oidcConfig.clientId,
        redirectUri: oidcConfig.redirectUri,
        scope: oidcConfig.scope,
        codeChallenge: pkce.codeChallenge,
      });
      storeAuthRequest({ state, codeVerifier: pkce.codeVerifier });
      window.location.href = url;
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Unknown error starting login');
    }
  }

  return (
    <main>
      <h1>react-login demo</h1>
      {error && <p role="alert">{error}</p>}
      <button onClick={handleLogin} disabled={loading}>
        {loading ? 'Redirecting…' : 'Login'}
      </button>
    </main>
  );
}
```

- [ ] **Step 2: Verify**
```bash
cd /mnt/d/Example/react-login
npm run build
```
Expected: exits with status 0, no TypeScript errors.

- [ ] **Step 3: Commit**
```bash
cd /mnt/d/Example/react-login
git add src/pages/Home.tsx
git commit -m "feat(react-login): add Home page login button"
```

---

### Task 4: Callback page — token exchange and session creation

**Files:**
- Create: `/mnt/d/Example/react-login/src/pages/Callback.tsx`

**Interfaces:**
- Consumes: `fetchOidcConfiguration`, `exchangeCodeForToken(params: ExchangeCodeForTokenParams): Promise<TokenResponse>`, `decodeIdToken(params: DecodeIdTokenParams): Promise<Claims>`, `createSession(tokenResponse: TokenResponse, claims: Claims | null): Session`, and error classes `OAuth2Error`, `DiscoveryError`, `TokenExchangeError`, `DecodeError`, `ConfidentialClientInBrowserError` from `request-oauth2`; `oidcConfig` from `../oidcClient` (Task 2); `loadAuthRequest`, `clearAuthRequest`, `storeSession` from `../storage` (Task 2).
- Produces: `Callback` component (named export) that performs the full callback flow and renders a distinct error message per failure mode. Task 5 wires this into routing at `/callback` and its error paths become browser-reachable then, so this task's verification is build-only.

- [ ] **Step 1: Create `src/pages/Callback.tsx`**
Create `/mnt/d/Example/react-login/src/pages/Callback.tsx` with:
```tsx
import { useEffect, useState } from 'react';
import {
  ConfidentialClientInBrowserError,
  DecodeError,
  DiscoveryError,
  OAuth2Error,
  TokenExchangeError,
  createSession,
  decodeIdToken,
  exchangeCodeForToken,
  fetchOidcConfiguration,
} from 'request-oauth2';
import { oidcConfig } from '../oidcClient';
import { clearAuthRequest, loadAuthRequest, storeSession } from '../storage';

type CallbackStatus = { kind: 'processing' } | { kind: 'error'; message: string } | { kind: 'done' };

export function Callback() {
  const [status, setStatus] = useState<CallbackStatus>({ kind: 'processing' });

  useEffect(() => {
    void handleCallback();

    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const returnedState = params.get('state');
      const errorParam = params.get('error');

      if (errorParam) {
        setStatus({ kind: 'error', message: `Authorization server returned an error: ${errorParam}` });
        return;
      }

      if (!code || !returnedState) {
        setStatus({ kind: 'error', message: 'Missing code or state in callback URL.' });
        return;
      }

      const authRequest = loadAuthRequest();
      if (!authRequest) {
        setStatus({
          kind: 'error',
          message: 'No pending login request found (state was lost, e.g. after a page reload before login completed).',
        });
        return;
      }

      if (authRequest.state !== returnedState) {
        setStatus({
          kind: 'error',
          message: 'State mismatch: the returned state does not match the value stored before redirecting to the authorization server.',
        });
        return;
      }

      try {
        const discovery = await fetchOidcConfiguration(oidcConfig.wellKnownUrl);

        const tokenResponse = await exchangeCodeForToken({
          tokenEndpoint: discovery.token_endpoint,
          clientId: oidcConfig.clientId,
          redirectUri: oidcConfig.redirectUri,
          code,
          codeVerifier: authRequest.codeVerifier,
        });

        if (!tokenResponse.id_token) {
          setStatus({ kind: 'error', message: 'Token response did not include an id_token.' });
          return;
        }

        const claims = await decodeIdToken({
          decodeEndpoint: oidcConfig.decodeEndpoint,
          idToken: tokenResponse.id_token,
        });

        const session = createSession(tokenResponse, claims);
        storeSession(session);
        clearAuthRequest();
        setStatus({ kind: 'done' });
        window.location.href = '/';
      } catch (err) {
        clearAuthRequest();
        if (err instanceof DiscoveryError) {
          setStatus({ kind: 'error', message: `Failed to load OIDC discovery document: ${err.message}` });
        } else if (err instanceof ConfidentialClientInBrowserError) {
          setStatus({ kind: 'error', message: `Client configuration error: ${err.message}` });
        } else if (err instanceof TokenExchangeError) {
          setStatus({ kind: 'error', message: `Token exchange failed: ${err.message}` });
        } else if (err instanceof DecodeError) {
          setStatus({ kind: 'error', message: `Failed to decode id_token: ${err.message}` });
        } else if (err instanceof OAuth2Error) {
          setStatus({ kind: 'error', message: err.message });
        } else {
          setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Unknown error during login callback.' });
        }
      }
    }
  }, []);

  if (status.kind === 'processing') {
    return (
      <main>
        <p>Completing login…</p>
      </main>
    );
  }

  if (status.kind === 'error') {
    return (
      <main>
        <h1>Login failed</h1>
        <p role="alert">{status.message}</p>
        <a href="/">Back to home</a>
      </main>
    );
  }

  return (
    <main>
      <p>Login successful, redirecting…</p>
    </main>
  );
}
```

- [ ] **Step 2: Verify**
```bash
cd /mnt/d/Example/react-login
npm run build
```
Expected: exits with status 0, no TypeScript errors.

- [ ] **Step 3: Commit**
```bash
cd /mnt/d/Example/react-login
git add src/pages/Callback.tsx
git commit -m "feat(react-login): add Callback page with per-failure error handling"
```

---

### Task 5: Routing wiring, authenticated profile view, and logout

**Files:**
- Modify: `/mnt/d/Example/react-login/src/pages/Home.tsx` (full rewrite: add authenticated view + logout)
- Modify: `/mnt/d/Example/react-login/src/App.tsx` (full rewrite: pathname-based routing)
- Modify: `/mnt/d/Example/react-login/src/main.tsx` (full rewrite: named `App` import)
- Delete: `/mnt/d/Example/react-login/src/App.css`
- Delete: `/mnt/d/Example/react-login/src/assets/react.svg`

**Interfaces:**
- Consumes: `isAuthenticated(session): boolean` and the `Session` type from `request-oauth2`; `loadSession`, `clearSession` from `../storage` (Task 2); `Home` (Task 3) and `Callback` (Task 4) components.
- Produces: `App` component (named export, `src/App.tsx`) that renders `Home` at `/` and `Callback` at `/callback` — this is the final wiring; the app is now fully reachable in a browser. `Home` now shows the logged-in profile (claims) + Logout when a session exists in `sessionStorage`, otherwise the Login button from Task 3.

- [ ] **Step 1: Rewrite `src/pages/Home.tsx`**
Replace the contents of `/mnt/d/Example/react-login/src/pages/Home.tsx` with:
```tsx
import { useState } from 'react';
import { buildAuthorizationUrl, fetchOidcConfiguration, generatePkcePair, isAuthenticated } from 'request-oauth2';
import type { Session } from 'request-oauth2';
import { oidcConfig } from '../oidcClient';
import { clearSession, loadSession, storeAuthRequest } from '../storage';

export function Home() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      const discovery = await fetchOidcConfiguration(oidcConfig.wellKnownUrl);
      const pkce = await generatePkcePair();
      const { url, state } = buildAuthorizationUrl({
        authorizationEndpoint: discovery.authorization_endpoint,
        clientId: oidcConfig.clientId,
        redirectUri: oidcConfig.redirectUri,
        scope: oidcConfig.scope,
        codeChallenge: pkce.codeChallenge,
      });
      storeAuthRequest({ state, codeVerifier: pkce.codeVerifier });
      window.location.href = url;
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Unknown error starting login');
    }
  }

  function handleLogout() {
    clearSession();
    setSession(null);
  }

  if (session && isAuthenticated(session)) {
    return (
      <main>
        <h1>react-login demo</h1>
        <p>Logged in.</p>
        <pre>{JSON.stringify(session.claims, null, 2)}</pre>
        <button onClick={handleLogout}>Logout</button>
      </main>
    );
  }

  return (
    <main>
      <h1>react-login demo</h1>
      {error && <p role="alert">{error}</p>}
      <button onClick={handleLogin} disabled={loading}>
        {loading ? 'Redirecting…' : 'Login'}
      </button>
    </main>
  );
}
```

- [ ] **Step 2: Rewrite `src/App.tsx`**
Replace the contents of `/mnt/d/Example/react-login/src/App.tsx` with:
```tsx
import { Callback } from './pages/Callback';
import { Home } from './pages/Home';

export function App() {
  const path = window.location.pathname;

  if (path === '/callback') {
    return <Callback />;
  }

  return <Home />;
}
```

- [ ] **Step 3: Rewrite `src/main.tsx`**
Replace the contents of `/mnt/d/Example/react-login/src/main.tsx` with:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 4: Remove unused Vite template assets**
```bash
cd /mnt/d/Example/react-login
rm -f src/App.css src/assets/react.svg
```

- [ ] **Step 5: Verify build**
```bash
cd /mnt/d/Example/react-login
npm run build
```
Expected: exits with status 0, no TypeScript errors (no dangling imports of the deleted `App.css`/`react.svg` — `App.tsx` and `main.tsx` no longer reference them).

- [ ] **Step 6: Verify routing and the backend-independent error path in the browser**
```bash
cd /mnt/d/Example/react-login
npm run dev
```
With the dev server running (mock-oidc-provider and decode-service do **not** need to be running for this step):
1. Navigate to `http://localhost:5173/`. Confirm the page shows the heading "react-login demo" and a "Login" button (no session is in `sessionStorage` yet).
2. Navigate to `http://localhost:5173/callback` directly (no query string). Confirm the page shows "Login failed" and the message "Missing code or state in callback URL." — this exercises `Callback`'s error branch without needing either backend service.
Stop the dev server (Ctrl+C) when done.

- [ ] **Step 7: Commit**
```bash
cd /mnt/d/Example/react-login
git add -A
git commit -m "feat(react-login): wire routing, authenticated profile view, and logout"
```

---

### Task 6: Manual end-to-end verification

**Files:** none (verification only, no code changes).

**Interfaces:**
- Consumes: the full app from Tasks 1–5, `mock-oidc-provider` (http://localhost:4000, client `react-login-public`, PKCE only) and `decode-service` (http://localhost:8000/decode), built independently per the design spec.
- Produces: confirmation that the complete login → callback → claims → logout flow works against real (mock) services.

- [ ] **Step 1: Start mock-oidc-provider**
In a separate terminal:
```bash
cd /mnt/d/Example/mock-oidc-provider
npm run dev
```
Expected: it starts listening on http://localhost:4000. If this project does not exist yet in your checkout, build it per its own plan first — this task cannot proceed without it running.

- [ ] **Step 2: Start decode-service**
In a separate terminal:
```bash
cd /mnt/d/Example/decode-service
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```
Expected: it starts listening on http://localhost:8000. If the virtual environment doesn't exist yet, create it first with `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`. If this project does not exist yet in your checkout, build it per its own plan first — this task cannot proceed without it running.

- [ ] **Step 3: Start react-login**
In a third terminal:
```bash
cd /mnt/d/Example/react-login
npm run dev
```
Expected: it starts listening on http://localhost:5173.

- [ ] **Step 4: Walk through the full login flow**
1. Open http://localhost:5173/ in a browser. Confirm the "Login" button is shown.
2. Click **Login**. Confirm the browser navigates to `http://localhost:4000/authorize?...` and the mock IdP page renders with a "Login as demo user" button.
3. Click **Login as demo user**. Confirm the browser redirects to `http://localhost:5173/callback?code=...&state=...`, briefly shows "Completing login…", then automatically redirects to `http://localhost:5173/`.
4. On `/`, confirm it now shows "Logged in.", a `<pre>` block containing the decoded JWT claims as JSON (at least `sub`, `email`, `name`, `iat`, `exp`), and a "Logout" button.

- [ ] **Step 5: Verify logout**
1. Click **Logout**. Confirm the page immediately reverts to showing the "Login" button (no claims, no "Logged in." text).
2. Reload the page (`F5`). Confirm it still shows the "Login" button (logout persisted — `sessionStorage` no longer has a session).

- [ ] **Step 6: Verify session survives a refresh while logged in**
1. Click **Login** and complete the mock login again (repeat Step 4).
2. Once back on `/` showing the claims, reload the page (`F5`). Confirm the claims and "Logout" button are still shown (session was read back from `sessionStorage`, not lost on refresh).
3. Click **Logout** to leave the app in a clean logged-out state.

- [ ] **Step 7: Verify state-mismatch handling**
1. Click **Login** and, at the mock IdP page, do **not** click through yet — instead open a new browser tab to http://localhost:5173/ and click **Login** again (this overwrites the stored `state`/`codeVerifier` in `sessionStorage` with a second, different value, since both tabs share the same `sessionStorage` for this origin).
2. Go back to the first tab (still on the mock IdP page from the first login attempt) and click **Login as demo user**.
3. Confirm the resulting `/callback` page shows "Login failed" with the message starting "State mismatch:" — the `state` returned from the first authorization request no longer matches the second request's `state` stored in `sessionStorage`.
4. Navigate back to `http://localhost:5173/` and confirm it shows the "Login" button (no partial/broken session was stored).

This task makes no code changes, so there is no commit step.
