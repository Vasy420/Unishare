# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

FastAPI (Python 3.11) + React 18 (CRA + CRACO) + MongoDB (Motor async) + WebSockets + JWT auth. Tailwind + shadcn/ui (Radix primitives) on the frontend.

## Run

Backend (port 8001 — note: not 8000 despite Dockerfile; `__main__` block and `.env` BACKEND_URL both pin 8001):
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

Frontend (port 3000, uses CRACO not raw CRA):
```bash
cd frontend
yarn install
yarn start         # craco start
yarn build         # craco build
yarn test          # craco test
```

Full stack via Docker (mongo + backend on 8000 + frontend nginx on :80):
```bash
docker-compose up --build
```
Compose backend exposes 8000, dev backend uses 8001 — keep `REACT_APP_BACKEND_URL` aligned with whichever you run.

Backend lint/format (configured, not enforced):
```bash
cd backend
black . && isort . && flake8 .
```

## Required env

`backend/.env`:
- `MONGO_URL`, `DB_NAME`, `SECRET_KEY` (JWT signing — change in prod)
- `FRONTEND_URL`, `BACKEND_URL`, `CORS_ORIGINS` / `ALLOWED_ORIGINS` (comma-separated; `"*"` allowed)
- Optional Google Drive: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_DRIVE_REDIRECT_URI`

`frontend/.env`: `REACT_APP_BACKEND_URL` (empty string = same-origin; nginx in Docker proxies `/api`).

CRACO opt-in flags: `DISABLE_HOT_RELOAD`, `REACT_APP_ENABLE_VISUAL_EDITS`, `ENABLE_HEALTH_CHECK` (see `frontend/craco.config.js`).

## Architecture

### Backend — single-file monolith
Everything lives in `backend/server.py` (~2100 lines). All Pydantic models, auth, routes, WebSocket signaling, Google Drive OAuth, RSA/Fernet file encryption, and rate limiting are in this one file. There are no submodules; do not split it unless asked.

Notable mechanics:
- **Routes mounted under `/api`** via `api_router` (`app.include_router(api_router)` at L2043). Two exceptions: `/` and `/health` are on the bare app, and the WebSocket lives at `/api/ws/{user_id}` declared on `app` directly (L1645).
- **JWT**: HS256, 7-day expiry, bearer header. Guest accounts get tokens too.
- **File encryption at rest**: each upload encrypts content with a per-file Fernet key, then RSA-wraps the Fernet key with `backend/keys/public_key.pem`. Keys auto-generated on first boot into `backend/keys/`.
- **Storage**: file bytes in `backend/uploads/`, metadata in Mongo `files` collection. Users in `users`, Drive OAuth in `drive_credentials`, chat in chat collections.
- **Rate limiting**: slowapi/`Limiter` keyed by remote address.
- **Security headers middleware** strips `X-Frame-Options` only for `/preview` paths so the inline file viewer can iframe across origins (3000 ↔ 8001).
- **Admin endpoints** under `/api/admin/*` (users, files, block, mute, delete).
- **Chat endpoints** under `/api/chat/messages` with reactions + pin.
- **Google Drive**: `/api/drive/connect` → OAuth → `/api/drive/callback`, then `/api/drive/files`, `/api/drive/share/{drive_file_id}`, `/api/drive/save/{file_id}`.

### Frontend — CRA + CRACO + Tailwind + shadcn
- `src/App.js` is the top-level router and orchestrator (~1000 lines). Many modals are mounted here; state lives at this level (selected file, upload/download progress, incoming P2P offer, etc.). `driveConfigured` is currently hard-coded `true` (L56) — flip to `false` to hide the Drive button.
- `src/contexts/` — `AuthContext` and `ThemeContext`. Auth supports an **offline/local mode**: tokens prefixed `local-` skip the network, and a fake user is stored in `localStorage`. See `utils/offline.js` and `utils/authStorage.js`.
- `src/utils/webrtcManager2.js` is the active WebRTC P2P file-transfer manager (the older `webrtcManager.js` is unused). 16KB chunked DataChannels, signaling over `/api/ws/{user_id}`.
- `src/utils/bluetoothManager.js` — Web Bluetooth file sharing.
- `src/components/ui/*` — shadcn/Radix primitives. Don't hand-edit these; regenerate if needed.
- Path alias `@` → `src/` (configured in CRACO + `jsconfig.json`).

### Guest behavior (load-bearing)
Guest accounts are **ephemeral**: on logout (button or tab close via `sendBeacon` to `/api/auth/logout-beacon`), the backend wipes the user record, their files on disk, and history. Only registered accounts persist. The beacon path passes the token in the URL because beacons cannot set Authorization headers (`App.js` ~L92-114). Don't break this flow when touching logout/unload code.

Guest data cap: `GUEST_DATA_LIMIT = 2 GB` (frontend constant in `App.js`; backend enforces server-side too).

## Conventions

- **Don't add new files when `server.py` is the right home.** This codebase has accepted the single-file backend; resist splitting it into modules unless the task is explicitly that refactor.
- Files ending `_old.{py,js}` are legacy reference (`server_old.py`, `App_old.js`) — read for context but do not modify.
- `test_result.md` is a free-form testing log, not a structured test report — informational only.
- Frontend uses `axios` with manual progress handlers, not fetch.
- Toasts: components `dispatchEvent(new CustomEvent('app-toast', { detail: { message, kind } }))` and `App.js` listens.

## Known gotchas

- Dockerfile says port 8000, dev `.env` says 8001, README mentions 8001 — keep frontend `REACT_APP_BACKEND_URL` in sync with whichever server you actually start.
- `SECRET_KEY` in committed `.env` looks like a Google OAuth secret leaked into the JWT key slot — treat as compromised; rotate before any deploy.
- CORS defaults to `*` with `allow_credentials=True`, which browsers reject. Set `ALLOWED_ORIGINS` explicitly for any real deployment.
- `frontend/node_modules/` is committed-adjacent (huge) — avoid globbing it; scope searches to `frontend/src/`.
