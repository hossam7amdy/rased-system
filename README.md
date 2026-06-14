# 🎓 Rased (راصد) Attendance System

A secure web application for university attendance management using high-frequency, dynamic QR codes. Each QR rotates every few seconds and is cryptographically signed, so screenshots and shared codes are useless.

## ✨ Features

### Anti-Cheating Engine

- **Rotating QR codes** — a new token every `QR_ROTATION_MS` (default 8s), pushed live over WebSocket
- **Short token validity** — tokens expire after `QR_VALIDITY_MS` (default 20s), so screenshots go stale fast
- **AES-256-GCM signed tokens** — forged or replayed tokens are rejected
- **Cache-backed validation** — Redis when configured, automatic in-memory fallback otherwise
- **One student, one scan per session**

### Professor

- Create, update, and delete courses
- Enroll students into courses
- Launch live attendance sessions with a projector-friendly rotating QR display
- Real-time attendance feed (students appear instantly as they scan)
- Course analytics with at-risk student detection (<25% attendance)
- Manual attendance override
- Export per-course and per-session reports to Excel

### Student

- Browser-based QR scanner (mobile-first, no app install)
- Live list of active sessions to scan into
- Personal attendance history and per-course percentages
- Instant scan feedback

### Admin

- Manage all users (list, delete)
- Register professor/student accounts
- Search students and courses
- Enroll students individually, in bulk, or via import

## 🧱 Tech Stack

**Monorepo** — Yarn workspaces (`backend`, `frontend`).

| Layer    | Stack                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------- |
| Backend  | Node ≥22.6, Express 5, TypeScript run directly via `--experimental-strip-types` (no build step)    |
| Backend  | PostgreSQL (`pg`), Redis optional (`redis`), Socket.IO, Zod validation, `injectus` DI, Pino logger |
| Backend  | Helmet, CORS, `express-rate-limit`, `jsonwebtoken`, `bcryptjs`, ExcelJS                            |
| Frontend | React 19, Vite 6, TailwindCSS 3, React Router 6, Axios, `html5-qrcode`, `qrcode`                   |
| Tooling  | Biome + Prettier (lint/format), Lefthook (git hooks), Vitest + Playwright (tests)                  |
| Deploy   | Frontend → Cloudflare Workers (Wrangler static assets); backend → any Node ≥22.6 host              |

> No backend transpile step: TypeScript runs natively via Node's `--experimental-strip-types`.

## 📋 Prerequisites

- Node.js **22.6+** and Yarn 1.x
- PostgreSQL 15+
- Redis 7+ (optional — falls back to an in-memory cache if unavailable)
- A modern browser with camera access (HTTPS required for the camera in production)
- Docker + Docker Compose (optional — for the Postgres/Redis dev services below)

## 🛠️ Installation

```bash
# Clone
git clone https://github.com/hossam7amdy/rased-system.git
cd rased-system

# Install all workspace dependencies (backend + frontend)
yarn install
```

### Database & Redis

The repo ships a `docker-compose.yml` that runs PostgreSQL and Redis for local
development. The Postgres service auto-creates the `rased` database via its
`POSTGRES_DB` setting, so no manual `createdb` step is needed.

```bash
# Start Postgres (database: rased) + Redis in the background
docker compose up -d
```

> The schema lives in `backend/scripts/init-db.ts` — the single source of DDL,
> shared with the test setup — so it's applied with `yarn init-db` (below)
> rather than a SQL script mounted into the container. Keeping one DDL source
> avoids drift between the app and the database.

Bringing your own Postgres/Redis instead? Create a database named `rased`
(e.g. `createdb rased`), point `.env` at it, and skip `docker compose`.

### Environment & schema

```bash
cd backend

# Copy the env template and fill in real values
cp .env.example .env

# Apply the schema (idempotent), then create the default admin
yarn init-db
node --experimental-strip-types scripts/create-admin.ts
```

All backend configuration is documented inline in
[`backend/.env.example`](backend/.env.example), which is kept in sync with the
Zod loader in `shared/config/env.ts`. The variables you must set:

- `DB_*` — Postgres connection (the defaults match `docker-compose.yml`)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — min 32 chars each
- `QR_SECRET` — min 32 chars; signs QR tokens, keep it secret
- `CORS_ORIGINS` — comma-separated allowed frontend origins

Redis is optional: leave `REDIS_HOST` empty to use the in-memory cache.

## 🚀 Running

### Development

From the repo root, this runs frontend and backend together:

```bash
yarn dev
```

Or run them individually:

```bash
yarn workspace backend dev    # backend with --watch
yarn workspace frontend dev   # Vite dev server
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api
- Health check: http://localhost:5000/api/health

### Production

```bash
# Backend (no build step needed)
yarn workspace backend start

# Frontend (Cloudflare Workers) — deploy script builds then publishes
yarn workspace frontend deploy   # = vite build && wrangler deploy
```

## 👤 Default Admin

Created by `scripts/create-admin.ts`:

```
Email:    admin@rased.edu
Password: pass@WORD#123
```

**⚠️ Change this password before any production use.**

## 🔐 Security

- **Signed QR tokens** — AES-256-GCM via `QR_SECRET`; short validity defeats screenshots/replay
- **JWT auth** — access + refresh tokens; sockets authenticate via the same JWT
- **Rate limiting** — 1000 req/min globally, 10 req/min on `/api/auth/login` to blunt brute-force
- **Helmet** security headers and **CORS** allowlist (origins validated at boot)
- **Zod validation** on every request body, query, and params
- **Parameterized SQL** throughout via `pg`

## 📊 API

All routes are under `/api`. Protected routes require `Authorization: Bearer <token>`.

### Auth

```
POST /api/auth/login
POST /api/auth/register          # admin or professor
GET  /api/auth/profile
```

### Courses

```
POST   /api/courses                       # professor
PATCH  /api/courses/:courseId             # professor
DELETE /api/courses/:courseId             # professor
GET    /api/courses                       # professor or student (role-aware)
GET    /api/courses/my-courses            # student
GET    /api/courses/:courseId
POST   /api/courses/:courseId/enroll      # professor
GET    /api/courses/:courseId/students    # professor
```

### Attendance

```
GET   /api/attendance/active-sessions         # student
POST  /api/attendance/sessions                # professor — starts session + QR rotation
PATCH /api/attendance/sessions/:sessionId/end # professor
POST  /api/attendance/scan                    # student
GET   /api/attendance/current-qr/:courseId    # professor
GET   /api/attendance/sessions/:sessionId
GET   /api/attendance/student                 # student
POST  /api/attendance/manual-override         # professor
```

### Analytics

```
GET /api/analytics/course/:courseId                       # professor
GET /api/analytics/student                                # student
GET /api/analytics/export?courseId=...&sessionId=...      # professor — Excel download
```

### Admin

```
GET    /api/admin/users
DELETE /api/admin/users/:id
GET    /api/admin/students?q=...
GET    /api/admin/courses?q=...
POST   /api/admin/enroll
POST   /api/admin/enroll-bulk
POST   /api/admin/enroll-import
```

### Health

```
GET /api/health
```

## 🔌 WebSocket

Clients connect to Socket.IO with a JWT, passed as `auth.token` (or a `token` header):

```javascript
const socket = io(API_URL, { auth: { token: jwt } });
```

### Professor → server

```javascript
socket.emit("start_attendance", courseId); // join room + start QR rotation
socket.emit("stop_attendance", courseId); // stop rotation + leave room
```

### Server → client

```javascript
socket.on("qr_update", ({ token, timestamp }) => {}); // new QR token
socket.on("student_attended", (payload) => {}); // student just scanned
socket.on("session_started", ({ courseId, message }) => {});
socket.on("error", ({ message }) => {});
```

## 🧪 Testing

```bash
yarn test          # frontend (vitest) + backend
yarn test:e2e      # frontend Playwright e2e

# Backend integration tests (need a Postgres test DB; see .env.test)
yarn workspace backend test:int
```

Lint, format, and type-check across the repo:

```bash
yarn check        # biome + prettier
yarn check:fix    # auto-fix
yarn typecheck
```

## 🏗️ Backend Architecture

- **Modular**: each domain (`auth`, `courses`, `attendance`, `analytics`, `admin`) has its own router, service, model, validator, and DTO under `backend/modules/`.
- **Dependency injection** via `injectus`: a root injector wires config, logger, cache, database, and services (`app.injector.ts`); a per-request middleware exposes `req.resolve(Token)`.
- **Validation**: `req.validBody/validQuery/validParams(schema)` run Zod schemas; failures are funneled to a central `errorHandler`.
- **Cache**: `CacheProvider` returns a Redis client when `REDIS_HOST` is set, otherwise an in-memory cache — same interface either way.
- **App vs. server**: `createApp()` builds the Express app with no port binding (used by tests); `server.ts` attaches Socket.IO and listens.

## 🐛 Troubleshooting

**Database connection failed** — check PostgreSQL is up (`pg_isready`), that `DB_NAME` exists (`psql -l`), and that `.env` credentials are correct.

**Cache** — Redis is optional; if `REDIS_HOST` is unset or unreachable the app logs a warning and uses the in-memory cache.

**WebSocket not connecting** — confirm the backend is running, the JWT is valid and passed as `auth.token`, and the client origin is in `CORS_ORIGINS`.

**QR scanner not working** — grant camera permission; the camera requires HTTPS in production.

**"Expired QR code"** — ensure server/client clocks are in sync and `QR_VALIDITY_MS` ≥ `QR_ROTATION_MS` (enforced at boot).

## 📄 License

ISC — see [`LICENSE`](LICENSE) file.

## 🎯 Roadmap

- [ ] Native mobile apps (iOS/Android)
- [ ] Biometric / facial verification
- [ ] AI-powered fraud detection
- [ ] LMS integration (Moodle, Canvas)
- [ ] Email notifications for at-risk students

---

Built with ❤️ for better education
