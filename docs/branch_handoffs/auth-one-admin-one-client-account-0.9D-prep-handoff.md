Branch: develop

1. Current branch
- `develop`

2. Files created
- `docs/branch_handoffs/auth-one-admin-one-client-account-0.9D-prep-handoff.md`

3. Files modified
- `docs/auth_contract_v1.md`
- `docs/data_model_v1.md`
- `docs/api_contracts_v1.md`
- `docs/audit_checklist_v1.md`
- `docs/architecture_v1.md`
- `docs/audit_log.md`

4. Auth model simplification summary
- V1 auth is now documented as one backend-controlled platform admin account plus one Clerk-backed client account per client.
- The contract removes V1 assumptions about client companies with sub-users, customer teams, selectable roles, selectable user types, and frontend-chosen client scope.
- Backend-resolved `client_id` remains authoritative for client data access.

5. Platform admin model summary
- V1 has one internal Sendwise platform admin account.
- The platform admin can access `/admin`, create and manage clients, and manage client invitations or access state.
- The platform admin is backend-controlled through secure configuration or temporary backend auth mapping, is not a client account, and does not have a `client_id`.

6. Client account/access model summary
- A client is the actual customer profile, person, or account that logs into `/client`.
- Each client has exactly one Clerk-backed login access in V1.
- Planned business storage is split between `clients` for profile data and `client_access` for Clerk invitation and identity mapping.
- V1 documents no `client_users` table, no role field, no team model, and no sub-user management.

7. Client onboarding/profile summary
- The client sets the password through Clerk.
- The client must provide `personal_name`.
- The client may provide optional `company_name` for company, studio, or brand labeling.
- Sendwise stores profile fields in Business PostgreSQL and never stores passwords, password hashes, reset tokens, or session secrets.

8. Invitation/access flow summary
- The platform admin creates or opens a client profile in `/admin/clients`, enters the client email, and calls `POST /admin/clients/{client_id}/invite-access`.
- FastAPI verifies the platform admin, creates the Clerk invitation, stores pending `client_access`, and Clerk sends the invitation email.
- The client opens the invite link, lands on a Sendwise onboarding route, sets the password through Clerk, completes `personal_name` and optional `company_name`, and then the backend activates access.
- V1 rules now state no role input, no user-type selector, no public signup, no admin-set password, and one active access per client.

9. Data model updates documented
- `clients` now documents minimum fields: `id`, `email`, `personal_name`, nullable `company_name`, `status`, `monthly_email_limit`, `daily_email_limit`, `created_at`, `updated_at`.
- `client_access` now documents minimum fields: `id`, unique `client_id`, `email`, nullable `clerk_user_id`, nullable `clerk_invitation_id`, `status`, nullable `invitation_status`, nullable `invited_at`, nullable `accepted_at`, `created_at`, `updated_at`.
- Allowed access statuses are `invited`, `active`, `suspended`, `archived`.
- Allowed invitation statuses are `pending`, `accepted`, `revoked`, `expired`.
- The docs now explain why `client_access` stays separate from `clients`.

10. API contract updates documented
- Added or clarified `POST /admin/clients/{client_id}/invite-access`, `POST /admin/clients/{client_id}/revoke-access`, `POST /admin/clients/{client_id}/suspend-access`, `POST /admin/clients/{client_id}/reactivate-access`, and `POST /client/onboarding/complete`.
- Admin access contracts now state that `invite-access` accepts `email` only and does not accept `role` or `user_type`.
- Client onboarding contracts now state that onboarding completion accepts `personal_name` and optional `company_name` only and does not accept trusted `client_id` or role.
- Required access language now uses `Platform admin` and `Active client account` instead of multi-role client-user language.

11. Audit checklist updates documented
- Added checks for no role selector, no admin/client selector, no multi-user or team UI in V1, backend-controlled platform admin, backend-derived `client_id`, one active access per client, no public signup route, and no `SignUpButton`.
- Added checks that `invite-access` accepts `email` only and onboarding accepts `personal_name` plus optional `company_name`.

12. Tests executed
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`

13. Tests not executed and why
- `PYTHONPATH=backend python3 -m pytest backend/tests` was not run because this was a docs-only contract update and no backend runtime code changed.
- `cd frontend && npm run build` and `cd frontend && npm run lint` were not run because this was a docs-only contract update and no frontend runtime code changed.

14. Contract changes requested
- Replace V1 multi-user client role language with one platform admin plus one client login per client.
- Replace planned `client_users` with planned `client_access`.
- Define onboarding profile fields as required `personal_name` plus optional `company_name`.
- Define backend-owned invite and onboarding API contracts without trusted frontend role or client scope input.

15. Risks/open questions
- Runtime code and placeholder auth behavior still reflect earlier milestone assumptions and remain to be aligned in a later implementation milestone.
- Implementation details for exact DB constraints and reconciliation behavior around invitation failures remain future work.
- The workspace contains a pre-existing untracked file, `docs/branch_handoffs/clerk-custom-login-0.9C.2-handoff.md`, which was not modified in this task.

16. Suggested next step
- Start the implementation milestone that aligns runtime auth and persistence with this simplified contract: backend-controlled platform admin recognition, `client_access` persistence, invite flow integration, and onboarding completion handling.

17. Coordinator Handoff
- `develop` now contains the simplified V1 auth, data-model, API, and audit contract for one platform admin plus one client account per client.
- The docs now explicitly keep Clerk as identity provider, FastAPI as gatekeeper, and Business PostgreSQL as business truth while removing V1 multi-user client assumptions.
- No runtime code, DB migration, or Clerk flow implementation was added; the next executor should implement against these updated contracts rather than the older multi-role model.

18. Confirmation that no frontend runtime code, backend runtime code, DB migration, Clerk API call, client access implementation, onboarding implementation, public signup, custom password form, custom 2FA, real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase was implemented
- Confirmed.
