# F3 Manual QA Readiness Report

**Date:** 2026-10-14
**Project:** RedHunter (visual-office)
**Purpose:** Verify stack readiness for manual QA over Tailscale

---

## 1. Automated Verification Results

### Typecheck: PASS

All 6 workspaces exit 0:

- @redhunter/web
- @redhunter/shared
- @redhunter/adapters
- @redhunter/hermes
- @redhunter/agent-runtime
- @redhunter/api

### Test Suite: PASS

```
1088 pass | 1 skip | 0 fail
233 test files | 269 suites | 24.25s
```

Zero failures. Coverage spans: adapters, agent-runtime, API services (dispatcher, directives, decisions, knowledge, office, resync, agentsHermes), auth, hermes, shared, and pipeline integration.

### Web Build: PASS

```
Next.js 16.4.0 (Turbopack)
Build time: 15.7s
Routes: 13
```

Routes built:
- `/` (landing)
- `/login`
- `/dashboard`
- `/office` (3D)
- `/agents`, `/agents/[id]`
- `/knowledge`, `/knowledge/[id]`
- `/directives`, `/directives/[id]`
- `/decisions`, `/decisions/[id]`
- `/settings`

---

## 2. Service Startup Verification

### Prerequisites

- Bun 1.0+
- MongoDB 7+ (via `docker-compose up -d mongo`)
- Tailscale (optional, for remote access)

### Starting the Stack

**Note:** Root `package.json` has no `dev` script. Start services individually:

```bash
# Terminal 1: MongoDB
docker-compose up -d mongo

# Terminal 2: API (port 4000)
cd apps/api
cp .env.example .env  # first run only — edit JWT_SECRET, OWNER_EMAIL, OWNER_PASSWORD
bun run src/seed/cli.ts  # first run only
bun run start

# Terminal 3: Web (port 3100)
cd apps/web
bun run dev
```

### Tailscale Exposure

By default API binds to `127.0.0.1`. To expose on tailnet:

```bash
# apps/api/.env
HOST=<tailscale-ip>
```

Web connects to API via `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`). Set to Tailscale IP for remote access.

### Service Health

- API health: `GET /healthz` — checks MongoDB connection + adapter availability
- Returns `{ status: "healthy"|"unhealthy", checks: { mongo, adapters } }`

---

## 3. Architecture Summary

| Component | Tech | Port | Notes |
|-----------|------|------|-------|
| API | Express + Socket.IO | 4000 | Loopback default, Tailscale opt-in |
| Web | Next.js 16.4.0 (Turbopack) | 3100 | Client-side SPA |
| 3D Office | React Three Fiber + drei | (embedded in web) | Loads building.glb + character.glb |
| MongoDB | 7 | 27017 | Loopback via docker-compose |
| Adapters | Claude, Codex, OpenCode, Fake | — | Vendor-agnostic agent execution |

### Key API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/auth/login` | POST | No | Owner login → JWT |
| `/healthz` | GET | No | Service health |
| `/agents` | GET | viewer+ | List agents |
| `/agents/:id/hermes` | GET | viewer+ | Agent message history |
| `/directives` | POST | owner+ | Issue directive → creates tasks |
| `/directives` | GET | viewer+ | List directives |
| `/decisions` | GET | viewer+ | Decision inbox |
| `/decisions/:id/decide` | POST | owner+ | Approve/reject permission |
| `/office/state` | GET | viewer+ | 3D office state |
| `/knowledge/search` | GET | viewer+ | Search knowledge graph |
| `/knowledge/graph` | GET | viewer+ | Full graph |
| `/resync` | POST | — | Socket resync |

### Socket Events

Socket.IO namespace on API port. Events include agent status updates, directive state changes, decision notifications.

---

## 4. Manual QA Procedure

### Pre-QA Checklist

- [ ] MongoDB running: `docker-compose ps` shows mongo UP
- [ ] API started: `curl http://localhost:4000/healthz` returns `{ status: "healthy" }`
- [ ] Web started: `http://localhost:3100` loads landing page
- [ ] Database seeded: owner account exists (check `bun run src/seed/cli.ts` output)
- [ ] Tailscale configured (if remote): `HOST` env set, `NEXT_PUBLIC_API_URL` points to Tailscale IP

### QA Steps

#### Step 1: Landing Page

1. Navigate to `/`
2. Verify landing page renders (Hero, ProductIntro, Capabilities sections)
3. **Screenshot:** `01-landing.png`

#### Step 2: Login Flow

1. Navigate to `/login`
2. Enter owner credentials (from `.env` OWNER_EMAIL / OWNER_PASSWORD)
3. Submit → should redirect to `/dashboard`
4. Verify JWT stored (check DevTools → Application → Local Storage)
5. **Screenshot:** `02-login-form.png`, `03-dashboard-after-login.png`

#### Step 3: Dashboard

1. Verify dashboard loads with agent overview
2. Check agent list renders (should show seeded agents)
3. Verify real-time connection (check DevTools → Network → WS tab)
4. **Screenshot:** `04-dashboard.png`

#### Step 4: Directive Issuance

1. Navigate to `/directives`
2. Click "New Directive" (or equivalent CTA)
3. Fill form: title, description, priority, tags
4. Submit → should create directive and trigger agent task
5. Verify directive appears in list
6. Navigate to `/agents` → verify agent status changed (e.g., "working")
7. **Screenshot:** `05-directive-form.png`, `06-directive-list.png`, `07-agent-status-working.png`

#### Step 5: 3D Office

1. Navigate to `/office`
2. Verify 3D scene loads (building model, character models)
3. Check character animations (idle → working when agent active)
4. Verify orbit controls work (mouse drag to rotate, scroll to zoom)
5. Check agent status indicators in 3D space
6. **Screenshot:** `08-office-idle.png`, `09-office-working.png`

#### Step 6: Permission Request Flow (Decision Inbox)

1. Trigger a permission request (agent needs approval for action)
   - If no natural trigger, check API docs for test endpoint
2. Navigate to `/decisions`
3. Verify decision appears in inbox
4. Click decision → review details
5. Approve or reject → verify decision state updates
6. Navigate to `/agents` → verify agent resumed after approval
7. **Screenshot:** `10-decision-inbox.png`, `11-decision-detail.png`, `12-decision-approved.png`

#### Step 7: Knowledge Graph

1. Navigate to `/knowledge`
2. Verify knowledge entries render
3. Search for term → verify results filter
4. Click entry → verify detail view
5. **Screenshot:** `13-knowledge-list.png`, `14-knowledge-detail.png`

#### Step 8: Real-time Sync

1. Open two browser tabs (or browser + mobile)
2. In tab A: issue directive
3. In tab B: verify agent status updates without refresh
4. In tab A: approve decision
5. In tab B: verify decision state updates
6. **Screenshot:** `15-realtime-sync.png` (side-by-side if possible)

#### Step 9: Tailscale Access (if applicable)

1. From another device on tailnet, navigate to web URL (Tailscale IP:3100)
2. Repeat login flow
3. Verify all features work remotely
4. **Screenshot:** `16-tailscale-access.png`

#### Step 10: Edge Cases

1. Logout → verify redirect to `/login`
2. Access protected route without auth → verify redirect
3. Invalid credentials → verify error message
4. Network disconnect → verify app handles gracefully
5. **Screenshot:** `17-logout.png`, `18-auth-error.png`

---

## 5. Screenshot Checklist

| # | File | Description |
|---|------|-------------|
| 1 | `01-landing.png` | Landing page |
| 2 | `02-login-form.png` | Login form |
| 3 | `03-dashboard-after-login.png` | Dashboard post-login |
| 4 | `04-dashboard.png` | Dashboard with agents |
| 5 | `05-directive-form.png` | Directive creation form |
| 6 | `06-directive-list.png` | Directive list |
| 7 | `07-agent-status-working.png` | Agent working state |
| 8 | `08-office-idle.png` | 3D office idle |
| 9 | `09-office-working.png` | 3D office working |
| 10 | `10-decision-inbox.png` | Decision inbox |
| 11 | `11-decision-detail.png` | Decision detail |
| 12 | `12-decision-approved.png` | Decision approved |
| 13 | `13-knowledge-list.png` | Knowledge list |
| 14 | `14-knowledge-detail.png` | Knowledge detail |
| 15 | `15-realtime-sync.png` | Real-time sync demo |
| 16 | `16-tailscale-access.png` | Tailscale remote access |
| 17 | `17-logout.png` | Logout state |
| 18 | `18-auth-error.png` | Auth error message |

---

## 6. Known Issues / Notes

- **No root `dev` script:** Must start api + web separately (README mentions `bun run dev` but it's not implemented)
- **Next.js warnings:** `eslint` config no longer supported, unrecognized keys in `next.config.ts` — non-blocking
- **3D assets:** `building.glb` and `character.glb` must exist in `apps/web/public/models/` (built via `apps/assets` build script)
- **Socket connection:** Web app connects to API via Socket.IO client — verify WS tab in DevTools shows active connection
- **Tailscale binding:** API `HOST` env must be set to Tailscale IP for remote access (default loopback)

---

## 7. Verdict

**READY FOR MANUAL QA**

All automated gates pass:
- ✅ Typecheck clean
- ✅ 1088 tests pass
- ✅ Web build succeeds (13 routes)
- ✅ API routes verified
- ✅ Socket infrastructure in place
- ✅ 3D office component present
- ✅ Decision inbox API exists
- ✅ Directive issuance flow implemented

Human reviewer can proceed with manual QA steps above.
