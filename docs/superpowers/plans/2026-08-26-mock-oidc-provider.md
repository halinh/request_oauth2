# mock-oidc-provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal, in-memory mock OIDC identity provider (Node/Express/TypeScript) that serves as the shared IdP for both the `react-login` (public client, PKCE) and `next-login` (confidential client, `client_secret`) demo apps.

**Architecture:** A single Express app on port 4000 exposes three routes: OIDC discovery, a two-step `/authorize` (GET renders a one-button mock login form, POST issues an authorization code and redirects), and `POST /token` (exchanges the code for an opaque `access_token` plus a real HS256-signed `id_token` minted with `jose`). Authorization codes live in a single process-local `Map`, keyed by the code string itself, and are deleted on first use — there is no database and no persistence across restarts.

**Tech Stack:** `express` ^4.19.2, `cors` ^2.8.5, `jose` ^5.9.6, `typescript` ^5.5.4, `tsx` ^4.19.1 (dev runner), `@types/express` ^4.17.21, `@types/cors` ^2.8.17, `@types/node` ^20.14.10. Node built-ins `node:crypto` for random codes/tokens and PKCE hashing — no extra ID/hash library needed.

**Spec:** /mnt/d/Example/request_oauth2/docs/superpowers/specs/2026-08-26-oauth2-demo-apps-design.md

## Global Constraints

- Runs on **port 4000**, in dev via `tsx`.
- Two hardcoded registered clients:
  - `react-login-public` — **public**, no secret, PKCE (S256) required at `/token`.
  - `next-login-confidential` — **confidential**, validated via `client_secret` at `/token`, no PKCE required.
- Two literal dev-only secrets that MUST appear byte-for-byte (other independent projects — `decode-service`, `next-login` — depend on these exact values):
  - JWT signing secret (HS256), env var `JWT_DEV_SECRET`: `dev-only-insecure-shared-secret-do-not-use-in-prod`
  - Confidential client secret, env var `OIDC_CLIENT_SECRET`, hardcoded as `next-login-confidential`'s secret: `next-login-dev-secret-do-not-use-in-prod`
- **State:** in-memory `Map` only, single process, resets on restart. No database, no other persistence.
- CORS enabled only on `/token` and `/.well-known/openid-configuration`, restricted to `http://localhost:5173` (the Vite dev origin). `/authorize` gets no CORS middleware (it's a top-level browser navigation).
- **No automated tests for this project.** Every verification step below is a manual, copy-pasteable `curl`/`node` command with its exact expected output — do not add vitest/jest or any test runner.

---

### Task 1: Project scaffold + minimal Express server

**Files:**
- Create: `/mnt/d/Example/mock-oidc-provider/package.json`
- Create: `/mnt/d/Example/mock-oidc-provider/tsconfig.json`
- Create: `/mnt/d/Example/mock-oidc-provider/.gitignore`
- Create: `/mnt/d/Example/mock-oidc-provider/.env.example`
- Create: `/mnt/d/Example/mock-oidc-provider/README.md`
- Create: `/mnt/d/Example/mock-oidc-provider/src/config.ts`
- Create: `/mnt/d/Example/mock-oidc-provider/src/store.ts`
- Create: `/mnt/d/Example/mock-oidc-provider/src/index.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `PORT`, `ISSUER`, `JWT_DEV_SECRET`, `CORS_ORIGIN`, `REGISTERED_CLIENTS` (with `RegisteredClient`/`ClientType` types) exported from `src/config.ts`; `authorizationCodes` Map and `AuthorizationCodeRecord` type exported from `src/store.ts`; a running Express `app` listening on port 4000 in `src/index.ts` that later tasks add routers to.

- [ ] **Step 1: Create the project directory and initialize git**
```bash
mkdir -p /mnt/d/Example/mock-oidc-provider
cd /mnt/d/Example/mock-oidc-provider
git init
```

- [ ] **Step 2: Create `package.json`**
```json
{
  "name": "mock-oidc-provider",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "cors": "^2.8.5",
    "jose": "^5.9.6"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.14.10",
    "tsx": "^4.19.1",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `.gitignore`**
```
node_modules/
dist/
.env
```

- [ ] **Step 5: Create `.env.example`**
```
JWT_DEV_SECRET=dev-only-insecure-shared-secret-do-not-use-in-prod
OIDC_CLIENT_SECRET=next-login-dev-secret-do-not-use-in-prod
```

- [ ] **Step 6: Create `README.md`**
```markdown
# mock-oidc-provider

Minimal mock OIDC identity provider for local development. Issues authorization
codes and signed `id_token`s (JWT, HS256) with no real credential entry — every
login is a single-click "Login as demo user".

## Run

```bash
npm install
npm run dev
```

Listens on **http://localhost:4000**.

## Endpoints

- `GET /.well-known/openid-configuration`
- `GET /authorize`
- `POST /authorize`
- `POST /token`

## Registered clients

| client_id | type | secret |
| --- | --- | --- |
| `react-login-public` | public | none — PKCE required |
| `next-login-confidential` | confidential | `next-login-dev-secret-do-not-use-in-prod` |

## Environment variables

| Variable | Default (used if unset) |
| --- | --- |
| `JWT_DEV_SECRET` | `dev-only-insecure-shared-secret-do-not-use-in-prod` |
| `OIDC_CLIENT_SECRET` | `next-login-dev-secret-do-not-use-in-prod` |

Copy `.env.example` to `.env` to override. State (authorization codes) is
in-memory only and resets whenever the process restarts.
```

- [ ] **Step 7: Create `src/config.ts`**
```typescript
// Shared configuration: port, issuer, dev secrets, and the hardcoded client registry.

export const PORT = 4000;
export const ISSUER = `http://localhost:${PORT}`;

// HS256 signing secret for id_token. Must match byte-for-byte the JWT_DEV_SECRET
// used by the independent decode-service project (see project spec, "Shared dev constants").
export const JWT_DEV_SECRET =
  process.env.JWT_DEV_SECRET ?? 'dev-only-insecure-shared-secret-do-not-use-in-prod';

export type ClientType = 'public' | 'confidential';

export interface RegisteredClient {
  clientId: string;
  type: ClientType;
  /** Only present for confidential clients. */
  secret?: string;
}

export const REGISTERED_CLIENTS: Record<string, RegisteredClient> = {
  'react-login-public': {
    clientId: 'react-login-public',
    type: 'public',
  },
  'next-login-confidential': {
    clientId: 'next-login-confidential',
    type: 'confidential',
    // Must match byte-for-byte the OIDC_CLIENT_SECRET used by next-login.
    secret: process.env.OIDC_CLIENT_SECRET ?? 'next-login-dev-secret-do-not-use-in-prod',
  },
};

// Vite dev origin — the only origin allowed to call /token and the discovery
// endpoint directly from the browser.
export const CORS_ORIGIN = 'http://localhost:5173';
```

- [ ] **Step 8: Create `src/store.ts`**
```typescript
// In-memory store of issued authorization codes, keyed by the code string.
// Single process, resets on restart — no database, per project spec.

export interface AuthorizationCodeRecord {
  clientId: string;
  redirectUri: string;
  scope: string;
  /** Present only when the authorizing client sent PKCE params (public client). */
  codeChallenge?: string;
  codeChallengeMethod?: string;
  createdAt: number;
}

export const authorizationCodes = new Map<string, AuthorizationCodeRecord>();
```

- [ ] **Step 9: Create `src/index.ts`**
```typescript
import express from 'express';
import { PORT } from './config.js';

const app = express();

app.get('/', (_req, res) => {
  res.json({ service: 'mock-oidc-provider', status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`mock-oidc-provider listening on http://localhost:${PORT}`);
});
```

- [ ] **Step 10: Install dependencies and verify the server boots**
```bash
cd /mnt/d/Example/mock-oidc-provider
npm install
npm run dev
```
In a second terminal, with the dev server still running:
```bash
curl -s http://localhost:4000/
```
Expected output:
```json
{"service":"mock-oidc-provider","status":"ok"}
```
Stop the dev server (Ctrl+C) before committing.

- [ ] **Step 11: Commit**
```bash
cd /mnt/d/Example/mock-oidc-provider
git add package.json tsconfig.json .gitignore .env.example README.md src/config.ts src/store.ts src/index.ts
git commit -m "chore(mock-oidc-provider): scaffold Express + TypeScript project"
```

---

### Task 2: OIDC discovery endpoint

**Files:**
- Create: `/mnt/d/Example/mock-oidc-provider/src/routes/discovery.ts`
- Modify: `/mnt/d/Example/mock-oidc-provider/src/index.ts` (mount the discovery router)

**Interfaces:**
- Consumes: `ISSUER` from `src/config.ts` (Task 1).
- Produces: `discoveryRouter` (Express `Router`) exported from `src/routes/discovery.ts`, serving `GET /.well-known/openid-configuration` with fields `issuer`, `authorization_endpoint`, `token_endpoint` — later tasks' `/authorize` and `/token` routes must live at exactly those two paths.

- [ ] **Step 1: Create `src/routes/discovery.ts`**
```typescript
import { Router } from 'express';
import { ISSUER } from '../config.js';

export const discoveryRouter = Router();

discoveryRouter.get('/.well-known/openid-configuration', (_req, res) => {
  res.json({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    token_endpoint: `${ISSUER}/token`,
  });
});
```

- [ ] **Step 2: Modify `src/index.ts` to mount the discovery router**

Replace the full contents of `src/index.ts` with:
```typescript
import express from 'express';
import { PORT } from './config.js';
import { discoveryRouter } from './routes/discovery.js';

const app = express();

app.use(discoveryRouter);

app.get('/', (_req, res) => {
  res.json({ service: 'mock-oidc-provider', status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`mock-oidc-provider listening on http://localhost:${PORT}`);
});
```

- [ ] **Step 3: Verify**
```bash
cd /mnt/d/Example/mock-oidc-provider
npm run dev
```
In a second terminal:
```bash
curl -s http://localhost:4000/.well-known/openid-configuration
```
Expected output:
```json
{"issuer":"http://localhost:4000","authorization_endpoint":"http://localhost:4000/authorize","token_endpoint":"http://localhost:4000/token"}
```
Stop the dev server before committing.

- [ ] **Step 4: Commit**
```bash
cd /mnt/d/Example/mock-oidc-provider
git add src/routes/discovery.ts src/index.ts
git commit -m "feat(mock-oidc-provider): add OIDC discovery endpoint"
```

---

### Task 3: `/authorize` endpoint (mock login form + in-memory code issuance)

**Files:**
- Create: `/mnt/d/Example/mock-oidc-provider/src/routes/authorize.ts`
- Modify: `/mnt/d/Example/mock-oidc-provider/src/index.ts` (add urlencoded body parser + mount authorize router)

**Interfaces:**
- Consumes: `REGISTERED_CLIENTS` from `src/config.ts` (Task 1); `authorizationCodes`, `AuthorizationCodeRecord` from `src/store.ts` (Task 1).
- Produces: `authorizeRouter` (Express `Router`) exported from `src/routes/authorize.ts`, serving `GET /authorize` (renders the mock login HTML form) and `POST /authorize` (issues a code, writes an `AuthorizationCodeRecord` into `authorizationCodes` keyed by the code string, redirects to `redirect_uri?code=...&state=...`). Also produces the `express.urlencoded()` body-parser middleware in `src/index.ts`, which Task 4's `/token` route depends on for parsing its `application/x-www-form-urlencoded` body.

- [ ] **Step 1: Create `src/routes/authorize.ts`**
```typescript
import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { REGISTERED_CLIENTS } from '../config.js';
import { authorizationCodes } from '../store.js';

export const authorizeRouter = Router();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Step 1 of the authorize flow: validate the request and render a single-button
// mock login form. No real credential entry — this is a mock IdP.
authorizeRouter.get('/authorize', (req, res) => {
  const {
    response_type: responseType,
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
  } = req.query;

  if (typeof responseType !== 'string' || responseType !== 'code') {
    res.status(400).send('unsupported_response_type: only "code" is supported');
    return;
  }
  if (typeof clientId !== 'string' || !REGISTERED_CLIENTS[clientId]) {
    res.status(400).send('invalid_client: unknown client_id');
    return;
  }
  if (typeof redirectUri !== 'string' || redirectUri.length === 0) {
    res.status(400).send('invalid_request: redirect_uri is required');
    return;
  }

  const scopeValue = typeof scope === 'string' ? scope : '';
  const stateValue = typeof state === 'string' ? state : '';
  const codeChallengeValue = typeof codeChallenge === 'string' ? codeChallenge : '';
  const codeChallengeMethodValue =
    typeof codeChallengeMethod === 'string' ? codeChallengeMethod : '';

  res.type('html').send(`<!doctype html>
<html>
  <head><title>Mock OIDC Login</title></head>
  <body>
    <h1>Mock OIDC Provider</h1>
    <p>Client <strong>${escapeHtml(clientId)}</strong> is requesting access.</p>
    <form method="POST" action="/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(clientId)}" />
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}" />
      <input type="hidden" name="scope" value="${escapeHtml(scopeValue)}" />
      <input type="hidden" name="state" value="${escapeHtml(stateValue)}" />
      <input type="hidden" name="code_challenge" value="${escapeHtml(codeChallengeValue)}" />
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(codeChallengeMethodValue)}" />
      <button type="submit">Login as demo user</button>
    </form>
  </body>
</html>`);
});

// Step 2 of the authorize flow: the "Login as demo user" form submits here.
// Issues a single-use authorization code and redirects back to the client.
authorizeRouter.post('/authorize', (req, res) => {
  const {
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
  } = req.body as Record<string, string | undefined>;

  if (!clientId || !REGISTERED_CLIENTS[clientId]) {
    res.status(400).send('invalid_client: unknown client_id');
    return;
  }
  if (!redirectUri) {
    res.status(400).send('invalid_request: redirect_uri is required');
    return;
  }

  const code = randomBytes(32).toString('base64url');
  authorizationCodes.set(code, {
    clientId,
    redirectUri,
    scope: scope ?? '',
    codeChallenge: codeChallenge || undefined,
    codeChallengeMethod: codeChallengeMethod || undefined,
    createdAt: Date.now(),
  });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', code);
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }
  res.redirect(redirectUrl.toString());
});
```

- [ ] **Step 2: Modify `src/index.ts` to parse form bodies and mount the authorize router**

Replace the full contents of `src/index.ts` with:
```typescript
import express from 'express';
import { PORT } from './config.js';
import { discoveryRouter } from './routes/discovery.js';
import { authorizeRouter } from './routes/authorize.js';

const app = express();

app.use(express.urlencoded({ extended: true }));

app.use(discoveryRouter);
app.use(authorizeRouter);

app.get('/', (_req, res) => {
  res.json({ service: 'mock-oidc-provider', status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`mock-oidc-provider listening on http://localhost:${PORT}`);
});
```

- [ ] **Step 3: Verify the GET form renders**
```bash
cd /mnt/d/Example/mock-oidc-provider
npm run dev
```
In a second terminal:
```bash
curl -s "http://localhost:4000/authorize?response_type=code&client_id=react-login-public&redirect_uri=http://localhost:5173/callback&scope=openid%20profile%20email&state=abc123&code_challenge=testchallenge&code_challenge_method=S256"
```
Expected: an HTML page containing `<button type="submit">Login as demo user</button>` and a hidden `client_id` input with value `react-login-public`.

- [ ] **Step 4: Verify the POST issues a code and redirects**
```bash
curl -si -X POST http://localhost:4000/authorize \
  --data-urlencode "client_id=react-login-public" \
  --data-urlencode "redirect_uri=http://localhost:5173/callback" \
  --data-urlencode "scope=openid profile email" \
  --data-urlencode "state=abc123" \
  --data-urlencode "code_challenge=testchallenge" \
  --data-urlencode "code_challenge_method=S256"
```
Expected: HTTP status `302 Found` with a `Location` header of the form:
```
Location: http://localhost:5173/callback?code=<random-base64url-string>&state=abc123
```
Stop the dev server before committing.

- [ ] **Step 5: Commit**
```bash
cd /mnt/d/Example/mock-oidc-provider
git add src/routes/authorize.ts src/index.ts
git commit -m "feat(mock-oidc-provider): add /authorize endpoint + code store"
```

---

### Task 4: `/token` endpoint (PKCE / client_secret validation + JWT issuance)

**Files:**
- Create: `/mnt/d/Example/mock-oidc-provider/src/routes/token.ts`
- Modify: `/mnt/d/Example/mock-oidc-provider/src/index.ts` (mount token router)

**Interfaces:**
- Consumes: `ISSUER`, `JWT_DEV_SECRET`, `REGISTERED_CLIENTS` from `src/config.ts` (Task 1); `authorizationCodes` from `src/store.ts` (Task 1); the `express.urlencoded()` middleware already mounted in `src/index.ts` (Task 3).
- Produces: `tokenRouter` (Express `Router`) exported from `src/routes/token.ts`, serving `POST /token`, returning JSON `{ access_token, token_type: "Bearer", expires_in: 3600, id_token }` on success, where `id_token` is an HS256 JWT with claims `sub`, `email`, `name`, `iat`, `exp`, signed with `JWT_DEV_SECRET`.

- [ ] **Step 1: Create `src/routes/token.ts`**
```typescript
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { SignJWT } from 'jose';
import { ISSUER, JWT_DEV_SECRET, REGISTERED_CLIENTS } from '../config.js';
import { authorizationCodes } from '../store.js';

export const tokenRouter = Router();

// The single mock user every login produces.
const DEMO_USER = {
  sub: 'demo-user-1',
  email: 'demo.user@example.com',
  name: 'Demo User',
};

function base64UrlSha256(input: string): string {
  return createHash('sha256').update(input).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

tokenRouter.post('/token', async (req, res) => {
  const {
    grant_type: grantType,
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
    client_secret: clientSecret,
  } = req.body as Record<string, string | undefined>;

  if (grantType !== 'authorization_code') {
    res.status(400).json({ error: 'unsupported_grant_type' });
    return;
  }
  if (!code || !clientId || !redirectUri) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  const client = REGISTERED_CLIENTS[clientId];
  if (!client) {
    res.status(400).json({ error: 'invalid_client' });
    return;
  }

  const record = authorizationCodes.get(code);
  if (!record) {
    res
      .status(400)
      .json({ error: 'invalid_grant', error_description: 'unknown or already-used code' });
    return;
  }
  if (record.clientId !== clientId || record.redirectUri !== redirectUri) {
    res
      .status(400)
      .json({ error: 'invalid_grant', error_description: 'client_id or redirect_uri mismatch' });
    return;
  }

  if (client.type === 'public') {
    if (!codeVerifier || !record.codeChallenge) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'code_verifier required for public client',
      });
      return;
    }
    const computedChallenge = base64UrlSha256(codeVerifier);
    if (!safeEqual(computedChallenge, record.codeChallenge)) {
      res
        .status(400)
        .json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
      return;
    }
  } else {
    if (!clientSecret || !client.secret || !safeEqual(clientSecret, client.secret)) {
      res
        .status(401)
        .json({ error: 'invalid_client', error_description: 'client_secret mismatch' });
      return;
    }
  }

  // Single-use: delete the code now that it has been validated.
  authorizationCodes.delete(code);

  const accessToken = randomBytes(32).toString('base64url');
  const secretKey = new TextEncoder().encode(JWT_DEV_SECRET);
  const idToken = await new SignJWT({
    email: DEMO_USER.email,
    name: DEMO_USER.name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(DEMO_USER.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secretKey);

  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    id_token: idToken,
  });
});
```

- [ ] **Step 2: Modify `src/index.ts` to mount the token router**

Replace the full contents of `src/index.ts` with:
```typescript
import express from 'express';
import { PORT } from './config.js';
import { discoveryRouter } from './routes/discovery.js';
import { authorizeRouter } from './routes/authorize.js';
import { tokenRouter } from './routes/token.js';

const app = express();

app.use(express.urlencoded({ extended: true }));

app.use(discoveryRouter);
app.use(authorizeRouter);
app.use(tokenRouter);

app.get('/', (_req, res) => {
  res.json({ service: 'mock-oidc-provider', status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`mock-oidc-provider listening on http://localhost:${PORT}`);
});
```

- [ ] **Step 3: Verify the confidential-client flow (no PKCE needed, simplest full path)**
```bash
cd /mnt/d/Example/mock-oidc-provider
npm run dev
```
In a second terminal, get a code for the confidential client:
```bash
LOCATION=$(curl -si -X POST http://localhost:4000/authorize \
  --data-urlencode "client_id=next-login-confidential" \
  --data-urlencode "redirect_uri=http://localhost:3000/callback" \
  --data-urlencode "scope=openid profile email" \
  --data-urlencode "state=xyz789" \
  | grep -i '^location:' | sed 's/^[Ll]ocation: //' | tr -d '\r')
CODE=$(echo "$LOCATION" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')
echo "CODE=$CODE"
```
Exchange it at `/token`:
```bash
curl -s -X POST http://localhost:4000/token \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "code=$CODE" \
  --data-urlencode "redirect_uri=http://localhost:3000/callback" \
  --data-urlencode "client_id=next-login-confidential" \
  --data-urlencode "client_secret=next-login-dev-secret-do-not-use-in-prod"
```
Expected: JSON of the form:
```json
{"access_token":"<random-string>","token_type":"Bearer","expires_in":3600,"id_token":"<jwt>"}
```

- [ ] **Step 4: Verify the `id_token` is correctly signed and carries the right claims**

Get a fresh code (the one from Step 3 was already deleted on use):
```bash
LOCATION3=$(curl -si -X POST http://localhost:4000/authorize \
  --data-urlencode "client_id=next-login-confidential" \
  --data-urlencode "redirect_uri=http://localhost:3000/callback" \
  --data-urlencode "scope=openid" \
  --data-urlencode "state=s2" \
  | grep -i '^location:' | sed 's/^[Ll]ocation: //' | tr -d '\r')
CODE3=$(echo "$LOCATION3" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')
```
Exchange it and extract the `id_token`:
```bash
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:4000/token \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "code=$CODE3" \
  --data-urlencode "redirect_uri=http://localhost:3000/callback" \
  --data-urlencode "client_id=next-login-confidential" \
  --data-urlencode "client_secret=next-login-dev-secret-do-not-use-in-prod")
ID_TOKEN=$(echo "$TOKEN_RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).id_token))")
```
Verify the signature and inspect the claims:
```bash
node -e "
const crypto = require('crypto');
const secret = 'dev-only-insecure-shared-secret-do-not-use-in-prod';
const token = process.argv[1];
const [headerB64, payloadB64, sigB64] = token.split('.');
const data = headerB64 + '.' + payloadB64;
const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
console.log('signature valid:', expectedSig === sigB64);
console.log('payload:', JSON.parse(Buffer.from(payloadB64, 'base64url').toString()));
" "$ID_TOKEN"
```
Expected output:
```
signature valid: true
payload: {
  sub: 'demo-user-1',
  email: 'demo.user@example.com',
  name: 'Demo User',
  iss: 'http://localhost:4000',
  iat: <number>,
  exp: <number>
}
```
Stop the dev server before committing.

- [ ] **Step 5: Commit**
```bash
cd /mnt/d/Example/mock-oidc-provider
git add src/routes/token.ts src/index.ts
git commit -m "feat(mock-oidc-provider): add /token endpoint with PKCE + secret auth"
```

---

### Task 5: CORS + full end-to-end PKCE round trip

**Files:**
- Modify: `/mnt/d/Example/mock-oidc-provider/src/index.ts` (mount `cors` middleware on the two public-facing browser routes)

**Interfaces:**
- Consumes: `CORS_ORIGIN` from `src/config.ts` (Task 1); `discoveryRouter` (Task 2), `authorizeRouter` (Task 3), `tokenRouter` (Task 4).
- Produces: final `src/index.ts` — the complete, runnable mock-oidc-provider server. Nothing further depends on this task within this project.

- [ ] **Step 1: Modify `src/index.ts` to enable CORS on `/token` and the discovery endpoint**

Replace the full contents of `src/index.ts` with:
```typescript
import express from 'express';
import cors from 'cors';
import { PORT, CORS_ORIGIN } from './config.js';
import { discoveryRouter } from './routes/discovery.js';
import { authorizeRouter } from './routes/authorize.js';
import { tokenRouter } from './routes/token.js';

const app = express();

app.use(express.urlencoded({ extended: true }));

// CORS is only needed on the two routes react-login calls directly from the
// browser. /authorize is a top-level navigation and needs no CORS.
const corsMiddleware = cors({ origin: CORS_ORIGIN });
app.use('/.well-known/openid-configuration', corsMiddleware);
app.use('/token', corsMiddleware);

app.use(discoveryRouter);
app.use(authorizeRouter);
app.use(tokenRouter);

app.get('/', (_req, res) => {
  res.json({ service: 'mock-oidc-provider', status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`mock-oidc-provider listening on http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Verify CORS headers on `/token` and the discovery endpoint**
```bash
cd /mnt/d/Example/mock-oidc-provider
npm run dev
```
In a second terminal:
```bash
curl -si -X OPTIONS http://localhost:4000/token \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
```
Expected: HTTP `204 No Content` with header `Access-Control-Allow-Origin: http://localhost:5173`.
```bash
curl -si http://localhost:4000/.well-known/openid-configuration -H "Origin: http://localhost:5173"
```
Expected: `200 OK` with header `Access-Control-Allow-Origin: http://localhost:5173`.
```bash
curl -si http://localhost:4000/authorize?response_type=code -H "Origin: http://localhost:5173"
```
Expected: response has **no** `Access-Control-Allow-Origin` header (400 from missing params is fine — the point is the absence of the CORS header).

- [ ] **Step 3: Generate a PKCE `code_verifier` / `code_challenge` pair**
```bash
CODE_VERIFIER=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")
CODE_CHALLENGE=$(node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('base64url'))" "$CODE_VERIFIER")
echo "CODE_VERIFIER=$CODE_VERIFIER"
echo "CODE_CHALLENGE=$CODE_CHALLENGE"
```

- [ ] **Step 4: Full authorize → token round trip for the public client (`react-login-public`)**
```bash
LOCATION=$(curl -si -X POST http://localhost:4000/authorize \
  --data-urlencode "client_id=react-login-public" \
  --data-urlencode "redirect_uri=http://localhost:5173/callback" \
  --data-urlencode "scope=openid profile email" \
  --data-urlencode "state=xyz789" \
  --data-urlencode "code_challenge=$CODE_CHALLENGE" \
  --data-urlencode "code_challenge_method=S256" \
  | grep -i '^location:' | sed 's/^[Ll]ocation: //' | tr -d '\r')
echo "Location: $LOCATION"
CODE=$(echo "$LOCATION" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')
echo "CODE=$CODE"

curl -s -X POST http://localhost:4000/token \
  -H "Origin: http://localhost:5173" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "code=$CODE" \
  --data-urlencode "redirect_uri=http://localhost:5173/callback" \
  --data-urlencode "client_id=react-login-public" \
  --data-urlencode "code_verifier=$CODE_VERIFIER"
```
Expected: JSON of the form:
```json
{"access_token":"<random-string>","token_type":"Bearer","expires_in":3600,"id_token":"<jwt>"}
```

- [ ] **Step 5: Verify a wrong `code_verifier` is rejected (PKCE actually enforced)**
```bash
LOCATION2=$(curl -si -X POST http://localhost:4000/authorize \
  --data-urlencode "client_id=react-login-public" \
  --data-urlencode "redirect_uri=http://localhost:5173/callback" \
  --data-urlencode "scope=openid" \
  --data-urlencode "state=s3" \
  --data-urlencode "code_challenge=$CODE_CHALLENGE" \
  --data-urlencode "code_challenge_method=S256" \
  | grep -i '^location:' | sed 's/^[Ll]ocation: //' | tr -d '\r')
CODE2=$(echo "$LOCATION2" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')

curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4000/token \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "code=$CODE2" \
  --data-urlencode "redirect_uri=http://localhost:5173/callback" \
  --data-urlencode "client_id=react-login-public" \
  --data-urlencode "code_verifier=wrong-verifier-value"
```
Expected output: `400`.

- [ ] **Step 6: Verify a code cannot be reused (single-use enforcement)**

Re-run the exact same `/token` request from Step 4 a second time (same `$CODE`, same `$CODE_VERIFIER`):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4000/token \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "code=$CODE" \
  --data-urlencode "redirect_uri=http://localhost:5173/callback" \
  --data-urlencode "client_id=react-login-public" \
  --data-urlencode "code_verifier=$CODE_VERIFIER"
```
Expected output: `400` (code was deleted after Step 4's successful exchange).

Stop the dev server before committing.

- [ ] **Step 7: Commit**
```bash
cd /mnt/d/Example/mock-oidc-provider
git add src/index.ts
git commit -m "feat(mock-oidc-provider): enable CORS for Vite dev origin"
```
