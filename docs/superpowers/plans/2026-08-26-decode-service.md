# decode-service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal FastAPI service exposing `POST /decode`, which verifies an OIDC `id_token` (JWT, HS256) against a shared dev secret and returns its claims as JSON, so both demo apps (`react-login`, `next-login`) can decode tokens without embedding JWT logic themselves.

**Architecture:** A single-file FastAPI app (`main.py`) run with `uvicorn` on port 8000. It has two routes: a `GET /health` liveness check and the real `POST /decode` route, which uses `PyJWT` to verify signature + expiry against the `JWT_DEV_SECRET` environment variable (loaded via `python-dotenv` from a local `.env` file) and returns the decoded claims dict as the JSON response body. `CORSMiddleware` allows browser calls from `http://localhost:5173` (react-login).

**Tech Stack:** fastapi, uvicorn (with the `standard` extra, for the dev server), pyjwt, python-dotenv. No test framework — this project ships without automated tests per the spec's "Out of scope" section; verification is manual via `curl`.

**Spec:** /mnt/d/Example/request_oauth2/docs/superpowers/specs/2026-08-26-oauth2-demo-apps-design.md

## Global Constraints

- New project lives at `/mnt/d/Example/decode-service`, a sibling of `/mnt/d/Example/request_oauth2`. It is its own git repository (`git init` inside it) — it is **not** part of the `request_oauth2` repo.
- Service listens on **port 8000** (`uvicorn main:app --reload --port 8000`).
- JWT verification secret, env var `JWT_DEV_SECRET`, exact literal value (must match `mock-oidc-provider` byte-for-byte since this service verifies JWTs that service signs):
  ```
  dev-only-insecure-shared-secret-do-not-use-in-prod
  ```
- CORS enabled for `http://localhost:5173` (react-login's Vite dev origin) on all routes — leaving it open for other callers (e.g. next-login's server-to-server calls) is explicitly fine per the spec.
- No automated tests for this project. Every task's verification step is a concrete, copy-pasteable manual check (`curl` + exact expected response), not a test file.
- Single route contract: `POST /decode` takes `{ "id_token": "<jwt>" }` and returns the decoded claims as a JSON object on success, or `400` with an error body on an invalid/expired token.

---

### Task 1: Project scaffold, dependencies, and health check

**Files:**
- Create: `/mnt/d/Example/decode-service/.gitignore`
- Create: `/mnt/d/Example/decode-service/requirements.txt`
- Create: `/mnt/d/Example/decode-service/.env.example`
- Create: `/mnt/d/Example/decode-service/.env`
- Create: `/mnt/d/Example/decode-service/main.py`
- Create: `/mnt/d/Example/decode-service/README.md`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a runnable FastAPI app on port 8000 with `GET /health` returning `{"status": "ok"}`; the `main.py` module (with `app = FastAPI(...)`) that Task 2 and Task 3 extend in place; the `.venv` and installed dependencies that later tasks' `uvicorn` commands rely on; the `JWT_DEV_SECRET` value present in `.env` for Task 2 to read.

- [ ] **Step 1: Create the project directory and initialize git**
```bash
mkdir -p /mnt/d/Example/decode-service
cd /mnt/d/Example/decode-service
git init
```

- [ ] **Step 2: Create `.gitignore`**
Create `/mnt/d/Example/decode-service/.gitignore` with exactly:
```
.venv/
__pycache__/
.env
```

- [ ] **Step 3: Create `requirements.txt`**
Create `/mnt/d/Example/decode-service/requirements.txt` with exactly:
```
fastapi==0.115.0
uvicorn[standard]==0.32.0
pyjwt==2.9.0
python-dotenv==1.0.1
```

- [ ] **Step 4: Create the virtual environment and install dependencies**
```bash
cd /mnt/d/Example/decode-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
Expected: `pip install` completes with no errors, ending in a line like `Successfully installed fastapi-0.115.0 ... pyjwt-2.9.0 ... uvicorn-0.32.0 ... python-dotenv-1.0.1` (plus uvicorn's `standard` extras such as `uvloop`, `httptools`, `websockets`).

- [ ] **Step 5: Create `.env.example` and `.env`**
Create `/mnt/d/Example/decode-service/.env.example` with exactly:
```
JWT_DEV_SECRET=dev-only-insecure-shared-secret-do-not-use-in-prod
```
Create `/mnt/d/Example/decode-service/.env` with the same content (this is the real dev file the app loads; it's gitignored but the value is a known, published dev-only constant so committing `.env.example` with the literal value is intentional):
```
JWT_DEV_SECRET=dev-only-insecure-shared-secret-do-not-use-in-prod
```

- [ ] **Step 6: Create `main.py` with a minimal FastAPI app and health check**
Create `/mnt/d/Example/decode-service/main.py` with exactly:
```python
from fastapi import FastAPI

app = FastAPI(title="decode-service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 7: Create `README.md`**
Create `/mnt/d/Example/decode-service/README.md` with exactly:
````markdown
# decode-service

Minimal FastAPI service exposing `POST /decode`: verifies an OIDC `id_token`
(JWT, HS256) against a shared dev secret and returns its decoded claims as
JSON. Used by the `react-login` and `next-login` demo apps alongside
`mock-oidc-provider`.

## Run locally

```bash
cd /mnt/d/Example/decode-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # already present in this repo with the shared dev secret
uvicorn main:app --reload --port 8000
```

The service listens on `http://localhost:8000`.

## Routes

- `GET /health` — liveness check, returns `{"status": "ok"}`.
- `POST /decode` — body `{ "id_token": "<jwt>" }`. Verifies the JWT against
  `JWT_DEV_SECRET` (HS256) and returns the decoded claims as JSON. Returns
  `400` with `{"detail": "Invalid or expired token"}` for an invalid,
  tampered, or expired token.

## Manual end-to-end verification

See the "Manual end-to-end verification" section below (added once the
`/decode` route and CORS are implemented).
````

- [ ] **Step 8: Verify the health check**
```bash
cd /mnt/d/Example/decode-service
source .venv/bin/activate
uvicorn main:app --reload --port 8000 &
sleep 1
curl -s http://localhost:8000/health
```
Expected output:
```json
{"status":"ok"}
```
Then stop the server:
```bash
kill %1
```

- [ ] **Step 9: Commit**
```bash
cd /mnt/d/Example/decode-service
git add .gitignore requirements.txt .env.example main.py README.md
git commit -m "feat(decode-service): scaffold FastAPI app with health check"
```
(Note: `.env` is intentionally excluded by `.gitignore` and must NOT be added.)

---

### Task 2: `POST /decode` route with PyJWT verification

**Files:**
- Modify: `/mnt/d/Example/decode-service/main.py`

**Interfaces:**
- Consumes: the `app = FastAPI(...)` instance and `JWT_DEV_SECRET` value from Task 1.
- Produces: `POST /decode` accepting `{ "id_token": "<jwt>" }`, returning the decoded claims dict (e.g. `{"sub": ..., "email": ..., "name": ..., "iat": ..., "exp": ...}`) as JSON with status `200` on success, or status `400` with body `{"detail": "Invalid or expired token"}` on failure. Task 3 adds CORS middleware around this same app without changing this route's behavior. Task 4's verification examples rely on this exact success/error shape.

- [ ] **Step 1: Replace `main.py` with the `/decode` route added**
Replace the full contents of `/mnt/d/Example/decode-service/main.py` with exactly:
```python
import os

import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

load_dotenv()

JWT_DEV_SECRET = os.environ["JWT_DEV_SECRET"]

app = FastAPI(title="decode-service")


class DecodeRequest(BaseModel):
    id_token: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/decode")
def decode_token(payload: DecodeRequest) -> dict:
    try:
        claims = jwt.decode(payload.id_token, JWT_DEV_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    return claims
```

- [ ] **Step 2: Verify a valid token decodes successfully**
```bash
cd /mnt/d/Example/decode-service
source .venv/bin/activate
uvicorn main:app --reload --port 8000 &
sleep 1

TOKEN=$(python3 -c "
import jwt, time
secret = 'dev-only-insecure-shared-secret-do-not-use-in-prod'
payload = {
    'sub': 'demo-user-123',
    'email': 'demo@example.com',
    'name': 'Demo User',
    'iat': int(time.time()),
    'exp': int(time.time()) + 3600,
}
print(jwt.encode(payload, secret, algorithm='HS256'))
")

curl -s -X POST http://localhost:8000/decode \
  -H "Content-Type: application/json" \
  -d "{\"id_token\": \"$TOKEN\"}"
```
Expected output (an `iat`/`exp` will differ, matching the current timestamp when you ran the command):
```json
{"sub":"demo-user-123","email":"demo@example.com","name":"Demo User","iat":1798500000,"exp":1798503600}
```

- [ ] **Step 3: Verify an invalid (tampered) token is rejected with 400**
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/decode \
  -H "Content-Type: application/json" \
  -d "{\"id_token\": \"${TOKEN}tampered\"}"

curl -s -X POST http://localhost:8000/decode \
  -H "Content-Type: application/json" \
  -d "{\"id_token\": \"${TOKEN}tampered\"}"
```
Expected: first command prints `400`. Second command prints:
```json
{"detail":"Invalid or expired token"}
```

- [ ] **Step 4: Verify an expired token is rejected with 400**
```bash
EXPIRED_TOKEN=$(python3 -c "
import jwt, time
secret = 'dev-only-insecure-shared-secret-do-not-use-in-prod'
payload = {
    'sub': 'demo-user-123',
    'email': 'demo@example.com',
    'name': 'Demo User',
    'iat': int(time.time()) - 7200,
    'exp': int(time.time()) - 3600,
}
print(jwt.encode(payload, secret, algorithm='HS256'))
")

curl -s -X POST http://localhost:8000/decode \
  -H "Content-Type: application/json" \
  -d "{\"id_token\": \"$EXPIRED_TOKEN\"}"
```
Expected output:
```json
{"detail":"Invalid or expired token"}
```
Then stop the server:
```bash
kill %1
```

- [ ] **Step 5: Commit**
```bash
cd /mnt/d/Example/decode-service
git add main.py
git commit -m "feat(decode-service): add POST /decode route with PyJWT verification"
```

---

### Task 3: CORS middleware for `http://localhost:5173`

**Files:**
- Modify: `/mnt/d/Example/decode-service/main.py`

**Interfaces:**
- Consumes: the `app` instance and `/decode` route from Task 2.
- Produces: the app responds to cross-origin requests from `http://localhost:5173` (react-login's Vite dev server) with `Access-Control-Allow-Origin: http://localhost:5173` on both preflight (`OPTIONS`) and actual (`POST`) responses. Task 4's verification uses this header directly.

- [ ] **Step 1: Replace `main.py` with CORS middleware added**
Replace the full contents of `/mnt/d/Example/decode-service/main.py` with exactly:
```python
import os

import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

JWT_DEV_SECRET = os.environ["JWT_DEV_SECRET"]

app = FastAPI(title="decode-service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DecodeRequest(BaseModel):
    id_token: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/decode")
def decode_token(payload: DecodeRequest) -> dict:
    try:
        claims = jwt.decode(payload.id_token, JWT_DEV_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    return claims
```

- [ ] **Step 2: Verify the CORS preflight response**
```bash
cd /mnt/d/Example/decode-service
source .venv/bin/activate
uvicorn main:app --reload --port 8000 &
sleep 1

curl -s -i -X OPTIONS http://localhost:8000/decode \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  | grep -i "access-control-allow-origin"
```
Expected output:
```
access-control-allow-origin: http://localhost:5173
```

- [ ] **Step 3: Verify the CORS header is also present on the real POST response**
```bash
TOKEN=$(python3 -c "
import jwt, time
secret = 'dev-only-insecure-shared-secret-do-not-use-in-prod'
payload = {'sub': 'demo-user-123', 'iat': int(time.time()), 'exp': int(time.time()) + 3600}
print(jwt.encode(payload, secret, algorithm='HS256'))
")

curl -s -i -X POST http://localhost:8000/decode \
  -H "Origin: http://localhost:5173" \
  -H "Content-Type: application/json" \
  -d "{\"id_token\": \"$TOKEN\"}" \
  | grep -i "access-control-allow-origin"
```
Expected output:
```
access-control-allow-origin: http://localhost:5173
```
Then stop the server:
```bash
kill %1
```

- [ ] **Step 4: Commit**
```bash
cd /mnt/d/Example/decode-service
git add main.py
git commit -m "feat(decode-service): enable CORS for http://localhost:5173"
```

---

### Task 4: Final end-to-end verification and README update

**Files:**
- Modify: `/mnt/d/Example/decode-service/README.md`

**Interfaces:**
- Consumes: the complete `main.py` from Task 3 (health check + `/decode` + CORS).
- Produces: a documented, reproducible manual verification procedure in `README.md` that anyone (including whoever later stands up `mock-oidc-provider`, `react-login`, or `next-login`) can run against this service standalone, without any of the other four sibling projects existing yet.

- [ ] **Step 1: Append a "Manual end-to-end verification" section to `README.md`**
Replace the placeholder line in `/mnt/d/Example/decode-service/README.md`:
```
See the "Manual end-to-end verification" section below (added once the
`/decode` route and CORS are implemented).
```
with the following full section (i.e. the final `README.md` "Manual end-to-end verification" section reads exactly):
````markdown
## Manual end-to-end verification

Start the server:

```bash
cd /mnt/d/Example/decode-service
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

In another terminal, mint a valid HS256 JWT signed with the same
`JWT_DEV_SECRET` this service verifies against (this stands in for the
`id_token` that `mock-oidc-provider` will issue once it exists):

```bash
TOKEN=$(python3 -c "
import jwt, time
secret = 'dev-only-insecure-shared-secret-do-not-use-in-prod'
payload = {
    'sub': 'demo-user-123',
    'email': 'demo@example.com',
    'name': 'Demo User',
    'iat': int(time.time()),
    'exp': int(time.time()) + 3600,
}
print(jwt.encode(payload, secret, algorithm='HS256'))
")
echo "$TOKEN"
```

Decode it:

```bash
curl -s -X POST http://localhost:8000/decode \
  -H "Content-Type: application/json" \
  -d "{\"id_token\": \"$TOKEN\"}"
```

Expected response (`200`, `iat`/`exp` reflect the actual run time):

```json
{"sub":"demo-user-123","email":"demo@example.com","name":"Demo User","iat":1798500000,"exp":1798503600}
```

Try a tampered token:

```bash
curl -s -X POST http://localhost:8000/decode \
  -H "Content-Type: application/json" \
  -d "{\"id_token\": \"${TOKEN}tampered\"}"
```

Expected response (`400`):

```json
{"detail":"Invalid or expired token"}
```

Try an expired token:

```bash
EXPIRED_TOKEN=$(python3 -c "
import jwt, time
secret = 'dev-only-insecure-shared-secret-do-not-use-in-prod'
payload = {
    'sub': 'demo-user-123',
    'iat': int(time.time()) - 7200,
    'exp': int(time.time()) - 3600,
}
print(jwt.encode(payload, secret, algorithm='HS256'))
")

curl -s -X POST http://localhost:8000/decode \
  -H "Content-Type: application/json" \
  -d "{\"id_token\": \"$EXPIRED_TOKEN\"}"
```

Expected response (`400`):

```json
{"detail":"Invalid or expired token"}
```
````

- [ ] **Step 2: Verify the README instructions work exactly as written**
Run every command block from Step 1 verbatim, top to bottom, in a fresh shell (with `.venv` activated as instructed). Confirm each `curl` output matches the "Expected response" shown, then stop the server:
```bash
kill %1
```

- [ ] **Step 3: Commit**
```bash
cd /mnt/d/Example/decode-service
git add README.md
git commit -m "docs(decode-service): add manual end-to-end verification steps"
```
