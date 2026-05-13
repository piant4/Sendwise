# Ownership V1

Source of truth: `project_handoff_v1.md`.

## Operational Boundary

Current architecture rules:

```txt
backend is gatekeeper
business postgresql is source of truth
listmonk is engine only
frontend calls backend only
n8n is not core V1
```

Contracts cannot be changed during feature branch work unless explicitly approved.

## Ownership By Layer

### Backend owns

- campaign creation rules
- trusted `client_id` scoping from auth and `client_access`
- validation of admin-selected `client_id` on campaign write flows
- cross-client denial
- slot-assignment validation
- legacy and future limit evaluation
- wizard step validation
- readiness and review enforcement
- Deliverability Guard decisions
- contact validation and suppression enforcement
- template persistence and campaign content copy rules
- AI usage logging and future AI orchestration
- listmonk sync and send orchestration

### Frontend owns

- admin wizard UX and navigation
- client read-only campaign dashboard UX
- form input for admin-managed draft interactions
- content preview rendering
- campaign/review status display
- calls to backend APIs only

Frontend does not own:
- trusted `client_id`
- slot policy
- Guard outcome
- send authorization
- provider selection
- client campaign write capability in V1

### Admin owns

- client operational status
- campaign creation
- client selection for new campaigns
- slot assignment
- content and template selection
- contact import or association
- review request
- simulation request
- send request
- slot creation, edit, archive, and limit policy
- client-level operational controls

### Client owns

- read-only visibility of own campaigns
- read-only visibility of own metrics, usage, blocked sends, and delivery outcomes
- future business feedback workflows only if explicitly introduced later

Client does not own:
- campaign creation
- campaign mutation
- contact import
- template selection or template CRUD
- slot assignment
- simulation or send request
- authorization outcome
- final limit calculation
- slot mutation policy

### listmonk owns

- technical lists
- technical subscribers
- technical campaigns
- technical dispatch mechanics
- provider-facing send execution after backend approval

### AI owns

- no autonomous ownership

AI may assist with:
- content generation
- subject and preview suggestions
- spam-risk and tone suggestions

AI may not own:
- authorization
- limits
- `client_id`
- dispatch

## Repository-Level Collaboration Boundary

Docs and contracts:
- `docs/` may change only when the task explicitly requests contract alignment

Backend implementation:
- `backend/app/api/`
- `backend/app/services/`
- `backend/app/repositories/`
- `backend/app/guard/`
- `backend/app/integrations/listmonk/`
- `backend/tests/`

Frontend implementation:
- `frontend/app/`
- `frontend/components/`
- `frontend/lib/`
- `frontend/types/`

Persistence:
- `db/`

Shared operational files:
- `scripts/`

## Audit Rules

- backend work must preserve gatekeeper ownership
- frontend work must preserve backend-only trust boundaries
- listmonk work must remain translation/execution only
- DB work must not become the product-policy engine
