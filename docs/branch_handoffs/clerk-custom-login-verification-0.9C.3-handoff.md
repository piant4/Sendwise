Branch: develop

1. Current branch
- `develop`

2. Issue reproduced
- Confirmed by code audit on the pre-fix login flow.
- The previous [LoginContent.tsx](/Users/leonardo/Documents/Sendwise/frontend/app/login/LoginContent.tsx) stopped after the initial password attempt and mapped `needs_first_factor` and `needs_second_factor` to blocking Italian errors instead of continuing the Clerk flow.
- Live reproduction of a real additional-verification account was not completed in this turn because no authorized QA credentials or TOTP/backup codes were available in the workspace.

3. Root cause confirmed
- Primary root cause: frontend rendering and flow control.
- First divergence point: the custom Sendwise login UI treated Clerk intermediate sign-in states as terminal errors instead of continuing with the next required factor.
- Evidence:
- the old code only completed on `signIn.status === "complete"`
- `needs_first_factor` returned the generic direct-access block
- `needs_second_factor` returned the generic "verifica aggiuntiva non ancora esposta" block
- Minimal fix boundary: [LoginContent.tsx](/Users/leonardo/Documents/Sendwise/frontend/app/login/LoginContent.tsx)

4. Files created
- [clerk-custom-login-verification-0.9C.3-handoff.md](/Users/leonardo/Documents/Sendwise/docs/branch_handoffs/clerk-custom-login-verification-0.9C.3-handoff.md)

5. Files modified
- [LoginContent.tsx](/Users/leonardo/Documents/Sendwise/frontend/app/login/LoginContent.tsx)
- [audit_log.md](/Users/leonardo/Documents/Sendwise/docs/audit_log.md)

6. Clerk statuses/factors handled
- Statuses handled in custom UI:
- `needs_first_factor`
- `needs_second_factor`
- `complete`
- controlled fail-closed messages for `needs_new_password`
- controlled fail-closed messages for `needs_client_trust`
- First-factor paths handled:
- password via `signIn.password(...)` when Clerk exposes password as a supported first factor
- `email_code`
- `phone_code`
- Second-factor paths handled:
- `totp`
- `phone_code`
- `email_code`
- `backup_code`
- Session activation now uses `clerk.setActive({ session: createdSessionId })` on completion.
- Note on SDK surface:
- the installed Clerk custom-flow proxy in this repo exposes `signIn.password`, `signIn.emailCode`, `signIn.phoneCode`, and `signIn.mfa.*`
- it does not expose legacy `prepareFirstFactor()` / `prepareSecondFactor()` on the `useSignIn()` proxy, so equivalent code-send methods were used for preparable factors

7. Custom verification UI summary
- The Sendwise-owned `/login` card remains the only visible auth surface.
- Email and password remain the entry step.
- If Clerk requires first-factor continuation, the UI stays Sendwise-styled and shows:
- Italian verification heading
- factor selector when more than one supported code factor is available
- controlled code input
- controlled resend action for code-based factors
- If Clerk requires second-factor continuation, the UI stays Sendwise-styled and shows:
- title `Verifica aggiuntiva`
- description `Inserisci il codice richiesto per completare l'accesso.`
- support for TOTP, phone code, email code, and backup code when exposed by Clerk
- Unsupported factor combinations now fail closed with an Italian support message only after checking available factors.

8. Signup/social exposure check
- No `SignUpButton` was added.
- No signup link or sign-up route affordance was added to the custom login page.
- No Google or social login UI was added.
- Browser verification on `http://localhost:3000/login` found:
- `Sign up`: `0`
- `Don't have an account`: `0`
- `Google`: `0`
- `Continue with Google`: `0`

9. Hydration warning assessment
- No app hydration warning was observed on the live `/login` page during browser verification.
- Browser logs showed only the expected Clerk development-keys warning.
- No SSR/client mismatch code was added:
- no `Date.now()` in rendered markup
- no `Math.random()` in rendered markup
- no `typeof window` branch that changes rendered markup
- no locale-date rendering added
- No browser-extension attribute warning was observed, so no extension-specific mitigation was applied.

10. Runtime verification result
- Verified live on `http://localhost:3000/login`:
- page loads successfully with Clerk frontend env present
- custom Sendwise login surface renders
- invalid credentials show controlled Italian error `Email o password non validi.`
- no signup/social UI appears
- no generic `verifica aggiuntiva non ancora esposta` message remains in the rendered page for the tested invalid-credential path
- Not completed live in this turn:
- real first-factor continuation with `email_code` or `phone_code`
- real second-factor continuation with `totp`, `phone_code`, `email_code`, or `backup_code`
- successful redirect after a real multi-step Clerk sign-in
- `/account` post-login check with a real authenticated session
- Reason not completed:
- the workspace does not provide authorized QA credentials or second-factor secrets for an account that actually enters Clerk intermediate verification states

11. Tests executed
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
- `grep -R "Continue with Google\\|Google" frontend/app frontend/components frontend/lib || true`
- in-app browser verification on `http://localhost:3000/login`

12. Tests not executed and why
- Real multi-step Clerk sign-in with additional verification was not executed because no authorized QA email/password plus TOTP or backup codes were available in this turn.
- `/account` verification after a successful live login was not executed because no real authenticated session was created.

13. Contract changes requested
- None.

14. Risks remaining
- The authenticated redirect path remains hard-coded to `/admin` in the current frontend flow, including the existing catch-all login route behavior, and that remains a separate follow-up outside this milestone scope.
- A live Clerk project could still expose unsupported second factors such as email-link-style MFA; those now fail closed with support guidance instead of dropping to prebuilt Clerk UI.
- Browser verification proved the page and controlled invalid-credential path, but not a real additional-verification success path.
- The worktree contains an unrelated pre-existing modification in [globals.css](/Users/leonardo/Documents/Sendwise/frontend/app/globals.css) outside this milestone scope.

15. Suggested next step
- Run one credentialed browser pass with a real Clerk QA account that is configured to require additional verification, then confirm:
- first-factor continuation if applicable
- second-factor continuation through the Sendwise UI
- final redirect destination for admin and client users
- `/account` still renders Clerk `UserProfile`

16. Coordinator Handoff
- The login surface remains fully Sendwise-owned and Italian-only.
- Clerk still owns identity verification and session issuance.
- FastAPI and backend auth logic were not changed.
- The fix is intentionally narrow: it converts the custom login page from a single-step password form into a Clerk-aware multi-step custom flow without introducing signup, social auth, or backend changes.

17. Confirmation that no backend, DB migration, client_access persistence, admin-created invitation flow, public signup, custom password storage, custom password reset/change, real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase was implemented
- Confirmed.
