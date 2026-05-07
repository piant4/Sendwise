Branch: develop

1. Current branch
- `develop`

2. Files created
- `docs/branch_handoffs/clerk-auth-runtime-verification-0.9C-handoff.md`

3. Files modified
- `docs/audit_log.md`

4. Clerk Dashboard checklist result
- Developer confirmation not available in this workspace for:
- public signup disabled or restricted
- allowed redirect URLs include local dev URLs
- sign-in URL is `/login`
- after sign-in URL is `/admin` or equivalent
- required test users exist
- No Clerk Dashboard changes were attempted from code.

5. Env/secrets verification result
- `git status --short` returned clean.
- `git diff --cached --name-only || true` returned no staged files.
- `git diff -- .env .env.local frontend/.env.local backend/.env.local || true` returned no tracked secret diff.
- No local `.env` or `.env.local` files were present under the repo at verification time.
- Required Clerk env vars were not present in the current shell environment.
- `.env.example` already contains Clerk placeholders and was not changed.
- No real secrets were found committed or staged.

6. Frontend runtime verification result
- Verified by build:
- `/login/[[...login]]` is present in the Next route tree, so nested login paths do not 404 at the App Router level.
- Boundary checks found no Sendwise signup route or `SignUpButton` exposure in `frontend/app`, `frontend/components`, or `frontend/lib`.
- Live runtime with missing Clerk env:
- `GET http://127.0.0.1:3000/login` returned `500 Internal Server Error`.
- `GET http://127.0.0.1:3000/admin` returned `500 Internal Server Error`.
- `GET http://127.0.0.1:3000/account` returned `500 Internal Server Error`.
- Next server log showed the exact cause:
- `@clerk/nextjs: Missing publishableKey.`
- Signed-out redirect behavior, signed-in admin access, signed-in client access, `/account` rendering, Clerk user menu behavior, and sign-out return flow were not executable because real Clerk env values and test users were not provided.

7. Backend runtime verification result
- Live runtime with missing Clerk backend env:
- `GET http://127.0.0.1:8000/health` returned `200 OK`.
- `GET http://127.0.0.1:8000/admin/clients` without auth returned `401 Unauthorized` with `{"detail":"Missing bearer token."}`.
- `GET http://127.0.0.1:8000/admin/clients` with `Authorization: Bearer invalid-token` returned `500 Internal Server Error` with `{"detail":"Clerk auth is not fully configured on the backend."}`.
- Automated tests also passed for:
- unauthenticated `GET /client/me` returns `401`
- valid mapped admin access
- valid mapped client access
- client blocked from admin with `403`
- suspended and archived users blocked with `403`
- authorized response shapes preserved
- Real Clerk-issued admin and client tokens were not available, so credentialed runtime verification was not completed.

8. Frontend-to-backend token verification result
- Code inspection confirms `frontend/lib/api.ts` remains the only frontend fetch boundary and attaches `Authorization: Bearer <token>` in backend mode through Clerk `auth().getToken()`.
- Live token transport was not verified end to end because no real Clerk session could be created in this environment.

9. 401/403 verification result
- Verified live:
- backend unauthenticated admin request returns `401`
- Verified by automated tests:
- unauthenticated admin and client protected routes return `401`
- client role against admin endpoint returns `403`
- suspended and archived mapped users return `403`
- Real runtime `403` with Clerk-issued tokens was not verified because test users and Clerk env were unavailable.

10. Signup exposure check
- `grep -R "SignUpButton\\|sign-up\\|signup" frontend/app frontend/components frontend/lib || true` returned no Sendwise-owned signup exposure.
- `frontend/app/login/LoginContent.tsx` still uses Clerk `SignIn` with `withSignUp={false}`.
- Public signup still depends on Clerk Dashboard policy and was not confirmable from this workspace.

11. Password/account management verification
- `frontend/app/account/[[...account]]/page.tsx` is still wired to Clerk `UserProfile`.
- No custom password-change or password-reset UI was added in this milestone.
- Live `/account` rendering was blocked by missing Clerk frontend env because the app failed before the page could render.

12. Fixes applied, if any
- No application fix was applied.
- Confirmed runtime defect:
- frontend missing Clerk env surfaces as a generic HTTP `500` to the browser instead of a clearer Sendwise-managed configuration error page.
- Verified root cause:
- `ClerkProvider` throws `@clerk/nextjs: Missing publishableKey` from `frontend/app/layout.tsx`.
- Minimal fix boundary:
- `frontend/app/layout.tsx`
- This file is outside the allowed modification scope for Milestone `0.9C`, so no patch was made.

13. Tests executed
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- `grep -R "from .*mock-api" frontend/app frontend/components || true`
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true`
- `grep -R "listmonk\\|postgres\\|database\\|smtp" frontend/app frontend/components frontend/lib || true`
- `grep -R "localStorage\\|sessionStorage\\|document.cookie" frontend/app frontend/components frontend/lib || true`
- `grep -R "SignUpButton\\|sign-up\\|signup" frontend/app frontend/components frontend/lib || true`
- Live probes against elevated local servers:
- `curl -i http://127.0.0.1:8000/health`
- `curl -i http://127.0.0.1:8000/admin/clients`
- `curl -i -H 'Authorization: Bearer invalid-token' http://127.0.0.1:8000/admin/clients`
- `curl -i http://127.0.0.1:3000/login`
- `curl -i http://127.0.0.1:3000/admin`
- `curl -i http://127.0.0.1:3000/account`

14. Tests not executed and why
- Live Clerk browser verification was not executed because the local environment did not contain the required Clerk env values.
- Live credentialed backend verification with real Clerk-issued admin and client tokens was not executed because no real Clerk app configuration or mapped test users were available.
- Playwright browser verification was not executed because the local browser engine required by the available Playwright tool was not installed.

15. Contract changes requested
- None.

16. Risks remaining
- The frontend currently gives a generic `500` to the browser when required Clerk frontend env is missing.
- Real auth runtime behavior against Clerk remains unverified until the required env values and mapped test users are provided locally.
- Clerk Dashboard restrictions for no public signup remain unconfirmed from code.
- `AUTH_USER_MAPPINGS_JSON` is still temporary runtime mapping, not `client_users` persistence.

17. Suggested next step
- Provide the real local Clerk env values and mapped test users, then rerun Milestone `0.9C` live verification.
- If a clear frontend missing-env failure is required before that rerun, expand allowed scope to include `frontend/app/layout.tsx` and apply the minimal guard there.

18. Coordinator Handoff
- Repository-level regression checks passed.
- Backend negative-path runtime checks passed for `/health` and unauthenticated protection, and backend missing Clerk config fails clearly.
- Frontend route shape is correct for `/login/[[...login]]`, but frontend runtime currently fails generically when Clerk publishable key is absent.
- End-to-end Clerk runtime verification against a real Clerk application is blocked by missing local Clerk env values and unavailable mapped runtime test users.

19. Confirmation that no DB migration, client_users persistence, admin-created user flow, public signup, custom password form, real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase was implemented
- Confirmed.
