Branch: develop

1. Current branch
- `develop`

2. Issue reproduced
- Confirmed at the Next.js route-tree level.
- The repo state before this fix exposed Clerk `SignIn` only through `frontend/app/login/page.tsx`.
- No optional catch-all login route existed, so nested Clerk path flows under `/login/*` had no matching App Router entry.

3. Root cause found
- The first divergence was in the frontend route structure, not in Clerk props, middleware protection, backend auth, or API transport.
- Clerk `SignIn` was mounted with `routing="path"` and `path="/login"`, but the app only defined a single `/login` page instead of the optional catch-all route Clerk expects for nested sign-in paths.

4. Files created
- `frontend/app/login/LoginContent.tsx`
- `frontend/app/login/[[...login]]/page.tsx`
- `docs/branch_handoffs/clerk-login-catchall-0.9B.1-handoff.md`

5. Files modified
- `frontend/proxy.ts`
- `docs/audit_log.md`

Files removed:
- `frontend/app/login/page.tsx`

6. Route structure result
- `/login` is now served by `frontend/app/login/[[...login]]/page.tsx`.
- Nested Clerk login flows under `/login/*` now resolve through the same optional catch-all route instead of failing at the Next route layer.
- `npm run build` and backend-mode `npm run build` both produced the route entry `ƒ /login/[[...login]]`.

7. Login visual preservation result
- The Sendwise login page surface was preserved by moving the existing JSX and Clerk `SignIn` appearance config into `frontend/app/login/LoginContent.tsx`.
- No redesign was introduced.
- The page still uses the same hero copy, brand mark, visual wrapper, and Clerk card styling.
- `withSignUp={false}` remains in place.
- The signed-in redirect to `/admin` remains unchanged.

8. Proxy/public route result
- `frontend/proxy.ts` now explicitly treats `/login` and `/login(.*)` as public routes.
- Existing protected-route coverage for `/admin(.*)`, `/client(.*)`, and `/account(.*)` was preserved.
- No auth architecture change was made.

9. Signup exposure check
- No `SignUpButton` is exposed in `frontend/app`, `frontend/components`, or `frontend/lib`.
- No `/sign-up` or `/signup` route was added.
- No public signup links were added by Sendwise UI code.
- `SignIn` still uses `withSignUp={false}`.
- Clerk dashboard configuration must still keep public signup disabled or restricted; no custom signup-hiding workaround was added.

10. Tests executed
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `grep -R "from .*mock-api" frontend/app frontend/components || true`
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true`
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true`
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true`
- `grep -R "SignUpButton\|sign-up\|signup" frontend/app frontend/components frontend/lib || true`

11. Tests not executed and why
- No live browser sign-in was executed against a real Clerk instance because verified Clerk environment values and authorized test credentials were not provided in this turn.
- No HTTP request was run against a live local Next server for `/login/*`; route compatibility was verified through successful App Router builds that emitted `ƒ /login/[[...login]]`.

12. Live Clerk verification status
- Not executed live.
- Verified locally at build level only:
- `/login` compiles.
- `/login/*` is now represented by an optional catch-all App Router route instead of a single-page-only route.

13. Contract changes requested
- None.

14. Risks remaining
- Live Clerk nested flow behavior still depends on valid Clerk environment configuration at runtime.
- If public signup is enabled in the Clerk Dashboard, Clerk-managed flows can still expose signup paths outside Sendwise-owned UI intent; operational Clerk configuration must keep public signup disabled or restricted.
- Existing unrelated dirty workspace changes remain outside this task.

15. Suggested next step
- Run one credentialed browser verification against the local frontend with real Clerk env values to confirm a nested Clerk login path under `/login/*` resolves end to end without a Next-level 404.

16. Coordinator Handoff
- Milestone `0.9B.1` closes the known route-shape gap left in `0.9B`.
- The fix stays entirely in the frontend route layer and public-route middleware classification.
- Clerk still owns identity.
- FastAPI still owns authorization and data access.
- No signup, backend auth redesign, or additional auth features were introduced.

17. Confirmation
- No backend, DB, Docker config, signup, custom password form, user CRUD, real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work was implemented.
