# Check Anti-Monolith

## Purpose

Ensure a proposed Sendwise change does not create monolithic files, mixed responsibilities, or future hotspots.

## When To Use

Use before feature work, before non-trivial fixes, when a file grows, when a new helper/service is proposed, or when logic appears to cross layers.

## Sendwise Layers

- backend API/router
- backend service
- backend repository
- backend guard
- backend listmonk integration
- frontend page
- frontend component
- frontend API client
- db schema
- scripts/audit
- docker/infra

## Hard Rules

- One file = one responsibility.
- No business logic in routers.
- No domain logic in the listmonk adapter.
- No frontend business or security enforcement as source of truth.
- No giant `utils.py`.
- No giant `page.tsx`.
- Backend remains the gatekeeper.
- Repository remains the persistence boundary.
- Deliverability decisions belong in backend service/Guard, not UI, adapter, scripts, or database triggers.
- Do not create a broad service, helper, or abstraction for a single local need.

## Responsibility Boundaries

Router files may parse HTTP input, call services, and return responses. They must not decide sendability, enforce campaign lifecycle rules, or build SQL queries.

Service files may own business use cases, orchestration, state transitions, Guard calls, and authorization decisions.

Repository files may own database reads and writes. They must not decide product policy or send authorization.

Guard files may evaluate deliverability, suppression, state eligibility, and fail-closed sending rules.

listmonk integration files may translate backend-approved operations into listmonk API calls and map responses. They must not decide client ownership, campaign state, contact sendability, or suppression policy.

Frontend pages compose views and call the frontend API client. They must not duplicate backend security or call listmonk/PostgreSQL.

Frontend components render state and user actions. They must not become data access or business policy modules.

Frontend API clients call FastAPI only.

DB schema defines persistence shape. It must not become the product policy engine.

Scripts and Docker files support audit, smoke, install, and runtime boundaries. They must not implement product logic.

## Procedure

1. Identify the files or layers that the proposed change would touch.
2. Name the single responsibility of each touched file.
3. Check whether the proposed logic belongs in that file's responsibility.
4. Check whether the change would create a new cross-layer shortcut or forbidden flow.
5. If split is required, propose the smallest split with clear ownership.

## Output Format

```txt
Verdict: OK | SPLIT NEEDED
Touched layers:
Responsibilities checked:
Boundary risks:
Required split, if any:
Forbidden flows found:
```

Use `OK` only when the proposed change preserves one responsibility per file and all Sendwise boundaries. Use `SPLIT NEEDED` when responsibilities are mixed or a layer would become a hotspot.
