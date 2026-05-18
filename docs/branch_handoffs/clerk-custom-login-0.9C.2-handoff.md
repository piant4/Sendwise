Branch: develop

1. Current branch
- `develop`

2. Issue reproduced
- Confirmed in code and prior runtime evidence.
- `frontend/app/login/LoginContent.tsx` rendered Clerk's prebuilt `SignIn` component directly on `/login`.
- That implementation left the visible auth surface under Clerk control instead of Sendwise control.

3. Root cause confirmed
- Primary root cause: frontend rendering.
- The first divergence from contract was the direct use of Clerk `<SignIn />` in `frontend/app/login/LoginContent.tsx`.
- Appearance customization was not sufficient because the page still depended on Clerk's prebuilt UI flow and inherited Clerk-owned surface decisions.

4. Files created
- `docs/branch_handoffs/clerk-custom-login-0.9C.2-handoff.md`

5. Files modified
- `frontend/app/login/LoginContent.tsx`
- `frontend/app/globals.css`
- `docs/audit_log.md`

6. Custom login implementation summary
- Replaced the Clerk prebuilt `SignIn` render with a Sendwise-owned email/password form.
- The form uses Clerk `useSignIn()` to submit credentials and `signIn.finalize()` to activate the session.
- Successful sign-in redirects to `/admin`.
- The Sendwise hero, card layout, and existing `/login/[[...login]]` route were preserved.
- Added only minimal CSS for controlled error feedback and disabled submit state.

7. Signup/social removal result
- No `SignUpButton` is rendered by Sendwise UI.
- No `sign-up` or `signup` strings were found in `frontend/app`, `frontend/components`, or `frontend/lib`.
- No Google or social button is rendered by Sendwise UI.
- No `Continue with Google` or `Google` strings were found in `frontend/app`, `frontend/components`, or `frontend/lib`.
- Clerk Dashboard must still keep public signup and social login disabled if they must remain unavailable in all environments.

8. Clerk auth behavior result
- Clerk remains the auth engine.
- The frontend now controls the visible login surface while delegating credential validation and session activation to Clerk.
- The custom form provides Italian controlled errors for invalid credentials, throttling, unsupported password auth, and incomplete first/second-factor states.
- `/account` was not modified and remains wired to Clerk `UserProfile`.

9. Runtime verification result
- Verified by code/build:
- `/login/[[...login]]` remains present in the Next route tree.
- `/admin`, `/client`, and `/account` remain protected routes in the existing app structure.
- Sendwise-owned login UI contains email field, password field, Italian copy, controlled submit state, and no signup/social surface.
- Not verified live in this turn:
- visual browser confirmation of `/login`
- real Clerk sign-in with authorized test user
- redirect to `/admin` after successful real login
- signed-out `/admin` protection redirect
- live `/account` interaction after login
- In-app browser verification was blocked by browser runtime/security limits, and no authorized real Clerk test credentials were provided.

10. Tests executed
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- `grep -R -n "from .*mock-api" frontend/app frontend/components || true`
- `grep -R -n "fetch(" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "SignUpButton" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "sign-up" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "signup" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "Continue with Google\|Google" frontend/app frontend/components frontend/lib || true`

11. Tests not executed and why
- Live browser verification of `/login` was not completed because the in-app browser path hit local-runtime/security limits for this workspace.
- Real Clerk login was not executed because no authorized test credentials were provided in this turn.
- Live `/account` verification after sign-in was not executed because no real authenticated session was created.

12. Contract changes requested
- None.

13. Risks remaining
- If Clerk Dashboard still allows public signup or social providers, those capabilities may remain available outside the Sendwise-owned UI intent.
- If the Clerk project does not support password sign-in, users will receive the controlled unsupported-strategy message until Dashboard config is aligned.
- Accounts requiring MFA or forced password reset are not fully handled by this minimal Sendwise login UI yet; they fail closed with an Italian message instead of dropping to Clerk prebuilt UI.
- Existing unrelated workspace change `frontend/.gitignore` remains outside this milestone.

14. Suggested next step
- Run one credentialed browser check against `/login` with a real Clerk test user and Dashboard settings confirmed for:
- password sign-in enabled
- public signup disabled
- social login disabled
- allowed redirect URLs aligned with local dev

15. Coordinator Handoff
- The visible login surface is now Sendwise-owned instead of Clerk-owned.
- Clerk still identifies users and manages session activation.
- Backend/FastAPI auth logic, DB, and protected route contracts were not changed.
- This milestone fixes the UI ownership problem without implementing signup, password storage, or backend auth redesign.

16. Confirmation that no backend, DB migration, client_users persistence, admin-created user flow, public signup, custom password storage, custom password reset/change, real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase was implemented
- Confirmed.
