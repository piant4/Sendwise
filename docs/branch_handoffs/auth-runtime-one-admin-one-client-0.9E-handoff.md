# Milestone 0.9E — Runtime Auth Model Alignment

## 1. Current branch

- `develop`

## 2. Old runtime assumptions found

- `backend/app/core/auth.py` previously hard-coded a four-role hierarchy through `ADMIN_ROLES = {"admin_owner", "admin_operator"}` and `CLIENT_ROLES = {"client_owner", "client_viewer"}`.
- `backend/app/core/auth.py` previously stored trusted auth state as `AuthenticatedUser.role`, which kept the runtime centered on role hierarchy instead of the V1 access-kind model.
- `backend/app/repositories/auth_users.py` previously declared `AuthRole = Literal["admin_owner", "admin_operator", "client_owner", "client_viewer"]`.
- `backend/app/repositories/auth_users.py` previously required `AUTH_USER_MAPPINGS_JSON` to decode to a list of records and validated client scope by checking `role.startswith("client_")`, which implied multiple client role variants.
- `backend/tests/test_clerk_auth.py` previously encoded the old role values and the old list-shaped `AUTH_USER_MAPPINGS_JSON` contract.
- `frontend/app/login/[[...login]]/page.tsx:8-9` still redirects every authenticated user to `/admin`, which is a remaining frontend role assumption outside the allowed edit list for this milestone.
- `frontend/app/layout.tsx:19-23` still sets `signInFallbackRedirectUrl="/admin"` and `signInForceRedirectUrl="/admin"`, which is another remaining frontend role assumption outside the allowed edit list.
- `frontend/components/auth/MockLoginForm.tsx:7-15` and `:59-74` still contain a dev-only admin/client selector. It appears unused by the live Clerk login route, but it remains an old assumption outside this milestone scope.

## 3. Files created

- `docs/branch_handoffs/auth-runtime-one-admin-one-client-0.9E-handoff.md`

## 4. Files modified

- `.env.example`
- `backend/app/api/admin.py`
- `backend/app/api/campaigns.py`
- `backend/app/core/auth.py`
- `backend/app/repositories/auth_users.py`
- `backend/tests/test_clerk_auth.py`
- `frontend/app/login/LoginContent.tsx`
- `docs/audit_log.md`

Note:
- `frontend/app/login/LoginContent.tsx` received a whitespace-only cleanup so `git diff --check` could pass.
- `frontend/app/globals.css` is also modified in the worktree, but that change is outside this milestone scope and was not touched by this task.

## 5. Runtime access model summary

- Runtime auth now trusts exactly two access kinds: `platform_admin` and `client`.
- Allowed statuses remain `active`, `invited`, `suspended`, and `archived`.
- Protected access is fail-closed for every non-`active` status.
- `platform_admin` may access admin endpoints only and must not carry a trusted `client_id`.
- `client` may access client endpoints only and must carry a trusted backend-owned `client_id`.
- Campaign endpoints keep the current safest auth posture by requiring an active authenticated backend user and not trusting frontend-selected scope.
- The backend still owns token validation, identity mapping, trusted access type, and trusted client scope.

## 6. Temporary mapping shape

Expected temporary `AUTH_USER_MAPPINGS_JSON` shape:

```json
{
  "user_clerk_admin_id": {
    "email": "admin@example.com",
    "access_type": "platform_admin",
    "status": "active",
    "client_id": null
  },
  "user_clerk_client_id": {
    "email": "client@example.com",
    "access_type": "client",
    "status": "active",
    "client_id": "client_demo"
  }
}
```

Runtime behavior:

- Missing mapping stays fail-closed with `403`.
- Invalid token or missing token returns `401`.
- Invalid backend mapping shape or invalid access values returns `500` and blocks access.
- `client` mappings without `client_id` fail closed.
- Unknown `access_type` values fail closed.
- Legacy role-only mappings such as `client_viewer` fail closed.

Compatibility note:

- Empty `[]` is still tolerated only as an empty mapping so the current backend default env value does not crash at boot.
- Non-empty list-shaped mappings are rejected.

## 7. Backend dependency changes

- `verify_clerk_token` remains the Clerk JWT verifier.
- `get_current_user` now resolves `access_type` instead of the old four-role model.
- `require_active_user` now owns the status gate for protected access.
- `require_platform_admin` replaces the old admin-role hierarchy check.
- `require_client_scope` enforces `client` access plus required backend-owned `client_id`.
- `require_client` now delegates to `require_client_scope`.
- `AuthUserRecord` now validates:
  - only `platform_admin` or `client`
  - `client` requires `client_id`
  - `platform_admin` must not include `client_id`
- `AuthUserRepository` now expects an object keyed by Clerk user id and raises a controlled `500` if backend auth mapping config is invalid.

## 8. Endpoint protection results

- `GET /health` remains public.
- `GET /admin/clients` requires an active `platform_admin`.
- `GET /admin/campaigns` requires an active `platform_admin`.
- `GET /client/me`, `GET /client/campaigns`, `GET /client/usage`, and `GET /client/blocked-sends` require an active `client` with trusted `client_id`.
- `POST /campaigns`, `POST /campaigns/{campaign_id}/authorize`, and `POST /campaigns/{campaign_id}/send` now explicitly depend on `require_active_user`, preserving the current safest runtime behavior.
- Verified boundary outcomes:
  - missing token -> `401`
  - invalid token -> `401`
  - active `platform_admin` -> admin endpoints allowed
  - active `client` -> client endpoints allowed
  - active `client` -> admin endpoints denied with `403`
  - active `platform_admin` -> client endpoints denied with `403`
  - `invited` / `suspended` / `archived` -> protected endpoints denied with `403`
  - invalid mapping config -> fail closed with `500`

## 9. Frontend assumption check

- `frontend/proxy.ts` already only protects `/admin`, `/client`, and `/account`; it does not expose role selection.
- `frontend/app/account/[[...account]]/page.tsx` remains a generic Clerk `UserProfile` with no team or role UI.
- `frontend/components/layout/` was not changed and does not expose team or member management UI.
- `frontend/app/login/LoginContent.tsx` does not expose a role selector; only whitespace was removed.
- Remaining frontend auth-alignment gaps still present outside the allowed edit scope:
  - `frontend/app/login/[[...login]]/page.tsx` redirects authenticated users to `/admin`
  - `frontend/app/layout.tsx` forces Clerk sign-in fallback and force redirects to `/admin`
  - `frontend/components/auth/MockLoginForm.tsx` still contains a dev-only admin/client selector

## 10. Env placeholder updates

- `.env.example` now shows the new object-shaped `AUTH_USER_MAPPINGS_JSON` placeholder with `access_type: "platform_admin"` and `access_type: "client"`.
- No real Clerk ids, secrets, or client ids were added.

## 11. Tests executed

- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- `grep -R "admin_owner\|admin_operator\|client_owner\|client_viewer" backend frontend docs/auth_contract_v1.md docs/data_model_v1.md docs/api_contracts_v1.md || true`
- `grep -R "client_users" backend frontend docs/auth_contract_v1.md docs/data_model_v1.md docs/api_contracts_v1.md || true`
- `grep -R "from .*mock-api" frontend/app frontend/components || true`
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true`
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true`
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true`
- `grep -R "SignUpButton\|sign-up\|signup" frontend/app frontend/components frontend/lib || true`

Observed grep results:

- Old role-name grep returned hits only in `backend/tests/test_clerk_auth.py`, where legacy values are used intentionally in negative fail-closed coverage.
- `client_users` grep returned only contract docs stating that V1 has no `client_users` table.
- `fetch(` grep returned only `frontend/lib/api.ts`, which is the expected frontend-to-backend API client boundary.
- The other required grep commands returned no hits.

## 12. Tests not executed and why

- No required automated check from the milestone list was skipped.
- Not executed:
  - live Clerk browser sign-in and redirect verification with real test accounts, because no real Clerk credentials or mapped test users were provided in the workspace
  - frontend redirect fixes in `frontend/app/layout.tsx` and `frontend/app/login/[[...login]]/page.tsx`, because those files are outside the allowed modification scope for this milestone

## 13. Contract changes requested

- None. The implementation aligns to the existing V1 auth contract.

## 14. Risks remaining

- The visible Clerk login flow still contains hard `/admin` redirect assumptions outside the allowed edit scope, so a real active client sign-in may still land on the wrong route until that frontend follow-up is authorized.
- `frontend/components/auth/MockLoginForm.tsx` still contains a dev-only admin/client selector outside scope. It appears unused, but it remains a stale assumption.
- The auth mapping is still backend env configuration, not persisted `client_access` business state.
- Invalid backend mapping config fails closed with `500`, which is secure for this milestone but still operationally brittle until real `client_access` persistence exists.
- The worktree contains an unrelated `frontend/app/globals.css` modification outside this milestone scope.

## 15. Suggested next step

- Allow a narrow frontend follow-up to remove the hard `/admin` Clerk redirects in `frontend/app/layout.tsx` and `frontend/app/login/[[...login]]/page.tsx`, then verify a real client sign-in lands on `/client`.
- After that, the next backend milestone can replace env-backed auth mapping with real `client_access` persistence.

## 16. Coordinator Handoff

- Runtime backend auth is now aligned to one `platform_admin` plus one `client` access model and is fail-closed for legacy role values and invalid client scope.
- Protected admin, client, and campaign endpoints were verified with automated tests and repo audit checks.
- Frontend route-target assumptions remain partially misaligned because two Clerk redirect files are outside the allowed edit scope for this milestone.
- Before committing, review the unrelated `frontend/app/globals.css` worktree change so it does not get mixed into this auth milestone unintentionally.

## 17. Scope confirmation

- No DB migration was implemented.
- No `client_access` DB persistence was implemented.
- No Clerk invitation API was implemented.
- No admin invite flow was implemented.
- No onboarding completion endpoint was implemented.
- No public signup was implemented.
- No custom password form was implemented.
- No custom 2FA was implemented.
- No real listmonk integration was implemented.
- No real sending was implemented.
- No AI was implemented.
- No n8n was implemented.
- No Celery was implemented.
- No Keycloak was implemented.
- No Metabase was implemented.
- No Postal was implemented.
- No Rspamd was implemented.
- No Budibase was implemented.
