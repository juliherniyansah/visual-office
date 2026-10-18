# Initial Super Admin Setup - Auto-Setup When No Users Exist

**Status:** approved  
**Intent:** CLEAR  
**Review required:** false  
**Created:** 2026-01-15  
**Slug:** initial-setup

---

## Context

When the database has zero users, the system should automatically show a setup page for creating the initial super admin (owner) account. This prevents the lockout scenario where no one can log in because no users exist.

**Current state:**
- No user creation endpoint exists
- Login page at `/login` assumes users already exist
- HumanRole enum: `'owner' | 'operator' | 'viewer'`
- Owner is the highest privilege role

**Trigger condition:** `db.users.countDocuments() === 0`

---

## Approach

### Backend (apps/api)

**Two new endpoints in `apps/api/src/routes/auth.ts`:**

1. **`GET /auth/setup-status`** (public)
   - Returns `{ needsSetup: boolean }`
   - Counts users in DB
   - No authentication required

2. **`POST /auth/setup`** (public but guarded)
   - Accepts `{ email, password }` in body
   - Validates with zod schema (email format, password min 8 chars)
   - Guards: only works when `users.count === 0`
   - Creates user with `role: 'owner'`
   - Uses existing `hashPassword()` (argon2id)
   - Returns JWT via `signAccessToken()` + public user object
   - Returns 409 Conflict if users already exist

**Files to modify:**
- `apps/api/src/routes/auth.ts` - add 2 endpoints
- `apps/api/src/http/response.ts` - add error message for setup conflict

### Frontend (apps/web)

**New setup page + routing logic:**

1. **`/setup` page** (`apps/web/src/app/setup/page.tsx`)
   - Form: email, password, confirm password
   - Client-side validation (password match, min length)
   - Calls `POST /auth/setup`
   - On success: stores JWT in localStorage, redirects to `/dashboard`
   - On error: shows error message

2. **Root redirect logic** (`apps/web/src/app/page.tsx`)
   - On mount: calls `GET /auth/setup-status`
   - If `needsSetup === true`: redirect to `/setup`
   - If `needsSetup === false`: redirect to `/login` (or `/dashboard` if already authenticated)

3. **API client** (`apps/web/src/lib/api.ts`)
   - Add `checkSetupStatus()` function
   - Add `setupInitialUser()` function

**Files to create:**
- `apps/web/src/app/setup/page.tsx` - setup page component

**Files to modify:**
- `apps/web/src/app/page.tsx` - add setup status check
- `apps/web/src/lib/api.ts` - add setup API functions

---

## Todos

### Backend Implementation

- [x] 1. Add error message to `apps/api/src/http/response.ts`
  - **File:** `apps/api/src/http/response.ts`
  - **Action:** Add `setupAlreadyComplete: 'Setup sudah selesai, user sudah ada'` to `ERROR_MESSAGES`
  - **Acceptance:** Error message constant exists
  - **QA:** TypeScript compiles without errors
  - **Commit:** `feat(api): add setup conflict error message`

- [x] 2. Add `GET /auth/setup-status` endpoint
  - **File:** `apps/api/src/routes/auth.ts`
  - **Action:** Add endpoint that counts users and returns `{ needsSetup: boolean }`
  - **Code:**
    ```typescript
    router.get('/auth/setup-status', async (req, res) => {
      const userCount = await deps.models.User.countDocuments();
      sendSuccess(res, { needsSetup: userCount === 0 });
    });
    ```
  - **Acceptance:** Returns `{ success: true, data: { needsSetup: true } }` when no users, `{ needsSetup: false }` when users exist
  - **QA:** Manual test with empty DB and with existing users
  - **Commit:** `feat(api): add setup status check endpoint`

- [x] 3. Add `POST /auth/setup` endpoint
  - **File:** `apps/api/src/routes/auth.ts`
  - **Action:** Add endpoint that creates first user with role='owner'
  - **Code structure:**
    ```typescript
    // Add zod schema at top
    const SetupBodySchema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    });
    
    router.post('/auth/setup', async (req, res) => {
      // 1. Validate body
      const body = SetupBodySchema.safeParse(req.body);
      if (!body.success) {
        sendError(res, 400, ERROR_MESSAGES.invalidBody);
        return;
      }
      
      // 2. Guard: only works when no users exist
      const userCount = await deps.models.User.countDocuments();
      if (userCount > 0) {
        sendError(res, 409, ERROR_MESSAGES.setupAlreadyComplete);
        return;
      }
      
      // 3. Hash password
      const passwordHash = await hashPassword(body.data.password);
      
      // 4. Create user with role='owner'
      const user = await deps.models.User.create({
        email: body.data.email,
        passwordHash,
        role: 'owner',
      });
      
      // 5. Generate JWT
      const publicUser = toPublicUser(user);
      const token = await signAccessToken(
        { sub: publicUser.id, role: publicUser.role },
        deps.jwtSecret,
      );
      
      // 6. Return token + user
      sendSuccess(res, { token, user: publicUser }, 201);
    });
    ```
  - **Acceptance:** Creates user with role='owner', returns JWT, rejects if users exist
  - **QA:** Test with empty DB (should succeed), test with existing user (should return 409)
  - **Commit:** `feat(api): add initial setup endpoint`

### Frontend Implementation

- [x] 4. Add setup API functions to `apps/web/src/lib/api.ts`
  - **File:** `apps/web/src/lib/api.ts`
  - **Action:** Add two functions
  - **Code:**
    ```typescript
    export async function checkSetupStatus(): Promise<{ needsSetup: boolean }> {
      const response = await fetch(`${API_BASE_URL}/auth/setup-status`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    }
    
    export async function setupInitialUser(email: string, password: string): Promise<{ token: string; user: PublicUser }> {
      const response = await fetch(`${API_BASE_URL}/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    }
    ```
  - **Acceptance:** Functions exist and call correct endpoints
  - **QA:** TypeScript compiles without errors
  - **Commit:** `feat(web): add setup API client functions`

- [x] 5. Create setup page at `apps/web/src/app/setup/page.tsx`
  - **File:** `apps/web/src/app/setup/page.tsx` (create new)
  - **Action:** Create form with email, password, confirm password
  - **Requirements:**
    - Use existing UI components from `@/components/ui` (input, button, card)
    - Client-side validation: password match, min 8 chars
    - Call `setupInitialUser()` on submit
    - On success: store token in localStorage (`auth_token`), redirect to `/dashboard`
    - On error: show error message below form
    - Loading state while submitting
  - **Acceptance:** Form works, creates user, redirects to dashboard
  - **QA:** Manual test: fill form, submit, verify user created in DB, verify redirect
  - **Commit:** `feat(web): add initial setup page`

- [x] 6. Update root page to check setup status
  - **File:** `apps/web/src/app/page.tsx`
  - **Action:** Add setup status check on mount
  - **Code structure:**
    ```typescript
    import { checkSetupStatus } from '@/lib/api';
    import { useRouter } from 'next/navigation';
    import { useEffect } from 'react';
    
    export default function HomePage() {
      const router = useRouter();
      
      useEffect(() => {
        checkSetupStatus()
          .then(({ needsSetup }) => {
            if (needsSetup) {
              router.replace('/setup');
            } else {
              // Check if already authenticated
              const token = localStorage.getItem('auth_token');
              if (token) {
                router.replace('/dashboard');
              } else {
                router.replace('/login');
              }
            }
          })
          .catch(() => {
            router.replace('/login');
          });
      }, [router]);
      
      return <div>Loading...</div>;
    }
    ```
  - **Acceptance:** Redirects to `/setup` when no users, to `/login` or `/dashboard` otherwise
  - **QA:** Test with empty DB (should redirect to /setup), test with existing user (should redirect to /login)
  - **Commit:** `feat(web): add setup status check to root page`

---

## Final Verification Wave

- [x] F1. **Backend integration test**
  - **Tool:** Manual curl or Postman
  - **Steps:**
    1. Start API with empty DB
    2. `GET /auth/setup-status` → expect `{ needsSetup: true }`
    3. `POST /auth/setup` with valid email/password → expect 201 + JWT
    4. `GET /auth/setup-status` → expect `{ needsSetup: false }`
    5. `POST /auth/setup` again → expect 409 Conflict
  - **Evidence:** Curl output showing all responses

- [x] F2. **Frontend E2E test**
  - **Tool:** Browser manual test
  - **Steps:**
    1. Start API + web with empty DB
    2. Navigate to `/` → should redirect to `/setup`
    3. Fill setup form, submit → should redirect to `/dashboard`
    4. Verify user exists in DB with role='owner'
    5. Restart with existing user, navigate to `/` → should redirect to `/login`
  - **Evidence:** Screenshots or screen recording

- [x] F3. **TypeScript compilation check**
  - **Tool:** `rtk tsc`
  - **Command:** Run in `apps/api` and `apps/web`
  - **Expected:** No errors

---

## Must-NOT-Have

- ❌ Multi-step onboarding wizard
- ❌ Email verification for initial setup
- ❌ Role selection UI (always 'owner')
- ❌ Ability to run setup again after first user exists
- ❌ Separate "super_admin" role (use existing 'owner')

---

## Dependencies

```
Backend (1-3) can run in parallel
Frontend (4-6) depends on backend completion
Final verification (F1-F3) depends on all implementation
```

---

## Estimated Effort

- **Backend:** ~100 LOC (2 endpoints + error message)
- **Frontend:** ~150 LOC (setup page + API functions + root redirect)
- **Total:** ~250 LOC
- **Time:** 30-45 minutes for experienced developer

---

## Notes

- Setup endpoint is public but guarded (only works when `users.count === 0`)
- First user always gets role='owner' (highest privilege)
- After setup, auto-login via returned JWT (no need to go to /login)
- Error messages in Indonesian (matches existing pattern)
