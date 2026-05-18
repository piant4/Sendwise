# Milestone 0.9E.1b — Remove Residual Clerk Admin Redirects

## 1. Current branch

- `develop`

## 2. Residual redirect issue found

- `frontend/app/layout.tsx:21-22` still configured `signInFallbackRedirectUrl="/admin"` and `signInForceRedirectUrl="/admin"`.
- That configuration could let Clerk-managed redirect paths bypass `/auth/redirect` and send authenticated client users to `/admin`.

## 3. Files created

- `docs/branch_handoffs/clerk-redirect-alignment-0.9E.1b-handoff.md`

## 4. Files modified

- `frontend/app/layout.tsx`
- `docs/audit_log.md`

## 5. Redirect changes applied

- Replaced `signInFallbackRedirectUrl="/admin"` with `signInFallbackRedirectUrl="/auth/redirect"`.
- Replaced `signInForceRedirectUrl="/admin"` with `signInForceRedirectUrl="/auth/redirect"`.
- Preserved `afterSignOutUrl="/login"`.
- No visual layout changes were made.

## 6. Remaining `/admin` redirect grep result

- Forbidden redirect grep:
- no matches
- Broad `/admin` grep still returns:
- `frontend/components/layout/AppShell.tsx` and `frontend/components/layout/MainNav.tsx` legitimate admin navigation references
- `frontend/lib/api.ts` legitimate `ADMIN_ROUTE` target used only after `/auth/me`
- `frontend/components/auth/MockLoginForm.tsx` dev-only mock role redirect logic outside the live Clerk flow and outside this task's allowed scope

## 7. Route protection result

- `frontend/proxy.ts` required no change.
- `/admin`, `/client`, and `/account` remain protected by Clerk authentication middleware.
- Access-type trust still stays in the backend through `/auth/redirect` plus `/auth/me`.

## 8. Tests executed

- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- `grep -R "from .*mock-api" frontend/app frontend/components || true`
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true`
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true`
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true`
- `grep -R "SignUpButton\|sign-up\|signup" frontend/app frontend/components frontend/lib || true`
- `grep -R "afterSignInUrl.*admin\|forceRedirectUrl.*admin\|fallbackRedirectUrl.*admin\|router.push('/admin')\|router.replace('/admin')" frontend/app frontend/components frontend/lib || true`
- `grep -R '"/admin"' frontend/app frontend/components frontend/lib || true`

## 9. Tests not executed and why

- Live Clerk sign-in and sign-out verification were not executed because no real Clerk credentials or mapped runtime test users were available in the workspace.

## 10. Runtime verification result

- Not executed live.
- No live success was claimed.

## 11. Contract changes requested

- None.

## 12. Risks remaining

- `frontend/components/auth/MockLoginForm.tsx` still contains dev-only mock role redirect logic outside the live Clerk flow and outside this task's allowed scope.
- The worktree still contains uncommitted 0.9E.1 backend and frontend auth-alignment changes from the prior milestone.

## 13. Suggested next step

- Commit the scoped 0.9E.1 and 0.9E.1b auth redirect changes together after reviewing the existing uncommitted files as one auth-routing slice.

## 14. Coordinator Handoff

- The residual Clerk provider `/admin` fallback risk is removed from the shared layout.
- `/auth/redirect` remains the only post-login destination chooser in the live Clerk flow.
- No backend or route-protection logic changed in this milestone.
- Forbidden post-login `/admin` redirect grep is clean.

## 15. Confirmation

- No backend was modified for this milestone.
- No DB migration was implemented.
- No `client_access` persistence was implemented.
- No Clerk invitation API was implemented.
- No admin invite flow was implemented.
- No onboarding endpoint was implemented.
- No public signup was implemented.
- No custom password form was implemented.
- No custom 2FA was implemented.
- No real listmonk was implemented.
- No real sending was implemented.
- No AI was implemented.
- No n8n was implemented.
- No Celery was implemented.
- No Keycloak was implemented.
- No Metabase was implemented.
- No Postal was implemented.
- No Rspamd was implemented.
- No Budibase was implemented.
