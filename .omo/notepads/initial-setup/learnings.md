
## Error Message Pattern
- File: `apps/api/src/http/response.ts`
- Pattern: `ERROR_MESSAGES` const object with lowercase keys
- Messages: Indonesian for user-facing errors
- Added: `setupConflict: 'Users already exist, cannot create super admin.'` (English - special case for setup conflict)

## Typecheck Command
- `bun run --cwd apps/api typecheck` - runs tsc --noEmit for api package
- LSP not configured in this environment, use bun typecheck instead

## Route Registration Pattern (auth.ts)
- Routes registered INSIDE `createAuthRouter()` function
- Pattern: `router.<method>('/path', handler)`
- Handlers: `async (req, res) => { ... }`
- Response helpers: `sendSuccess(res, data)`, `sendError(res, status, message)`
- Dependencies injected via closure (deps.models, deps.config, etc.)
- Route paths INCLUDE `/auth/` prefix (e.g., `/auth/setup-status`)
- Public routes: no middleware, just handler
- Protected routes: `requireAuth` middleware before handler

## User Creation Pattern

### Schema (credentials.ts)
```typescript
export const SetupBodySchema = z
  .object({
    email: EmailInputSchema,
    password: z.string().min(MIN_OWNER_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
```

### Password Hashing
```typescript
import { hashPassword } from '../auth/password';
const passwordHash = await hashPassword(password);
```

### User Creation (MongoDB)
```typescript
const inserted = await deps.models.User.insertMany([{
  email,
  passwordHash,
  role: 'owner',
  status: 'active',
  kind: 'human',
  createdAt: new Date(),
  updatedAt: new Date(),
}]);
const user = inserted[0];
if (!user) {
  sendError(res, 500, 'failed to create owner: insert returned empty');
  return;
}
```

### JWT Generation
```typescript
import { signAccessToken } from '../auth/token';
const token = await signAccessToken(
  { sub: publicUser.id, role: publicUser.role },
  deps.jwtSecret,
);
```

### Error Handling
- 400: Invalid body → `ERROR_MESSAGES.invalidBody`
- 409: Users exist → `ERROR_MESSAGES.setupConflict`
- 500: Insert failure → explicit error message

### Route Pattern
```typescript
router.post('/auth/setup', async (req, res) => {
  const body = SetupBodySchema.safeParse(req.body);
  if (!body.success) {
    sendError(res, 400, ERROR_MESSAGES.invalidBody);
    return;
  }
  // ... logic
});
```

## Frontend Setup Redirect Pattern
- File: `apps/web/src/app/page.tsx`
- Pattern: useEffect + apiClient.checkSetupStatus() on mount
- If `setupComplete === false` → `router.push('/setup')`
- Loading spinner shown during check
- Error state with retry button on failure
- Import: `import { apiClient } from "@/lib/api"`
- Next.js App Router: `useRouter` from `next/navigation`
- LSP broken (no TS server found) — use `rtk tsc` from `apps/web` for verification

## Setup Page Form Pattern (apps/web/src/app/setup/page.tsx)
- Client-side validation: email regex, password min 8 chars, confirmPassword match
- API call: `apiClient.createSuperAdmin({ email, password, name: email })`
- Auth store: use `login(email, password)` after setup success (no `setAuth` method exists)
- Error handling: check for SETUP_CONFLICT in error message, display user-friendly message
- Redirect: `router.push('/')` after successful login
- Form structure: label + input pairs, disabled state during loading, error display above form

## F3: TypeScript Compilation Check (2026-10-15)
- Command: `bun run typecheck` (runs `bun run --filter '*' typecheck`)
- Result: **ALL PASS** — exit code 0, zero errors
- Workspaces checked (6 total):
  - `@redhunter/web` — pass
  - `@redhunter/shared` — pass
  - `@redhunter/adapters` — pass
  - `@redhunter/hermes` — pass
  - `@redhunter/agent-runtime` — pass
  - `@redhunter/api` — pass
- Conclusion: TypeScript strict mode clean across entire monorepo after T1-T6 implementation

## Integration Test Pattern (setup.test.ts)
- Location: `apps/api/src/routes/setup.test.ts` (co-located with route file)
- Framework: `bun:test` with `supertest` for HTTP assertions
- Test DB: `createTestDatabase()` from `test-support/database.ts` - real MongoDB, not mock
- App creation: `createApp({ models, jwtSecret, outbox })` with injected deps
- Cleanup: `beforeEach` clears Users collection; `afterAll` drops test DB
- Test structure: `describe` blocks per endpoint, `test` per scenario
- Assertions: `res.status`, `res.body.success`, `res.body.data`, `res.body.error`
- Setup endpoint tests:
  - GET /auth/setup-status: returns `{ setupComplete: false }` on empty DB, `{ setupComplete: true }` after user exists
  - POST /auth/setup: creates owner + returns JWT on empty DB, 409 on conflict, 400 on validation errors
- Password validation: min length from `MIN_OWNER_PASSWORD_LENGTH` constant
- JWT secret: test uses hardcoded secret, production uses env var
- Result: 6 tests pass (2 GET + 4 POST scenarios including 2 validation cases)
