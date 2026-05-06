# Sendwise Frontend Design Reference V1

## 1. Purpose

This document defines the visual and structural design direction for the Sendwise frontend V1.

It is a reference for all frontend tasks on:

```txt
feature/frontend-v1
```

It must be used together with the authoritative project contracts:

```txt
docs/structural_contracts_v1.md
docs/api_contracts_v1.md
docs/data_model_v1.md
docs/states_v1.md
docs/ownership_v1.md
docs/audit_checklist_v1.md
docs/architecture_v1.md
docs/codex_prompt_engine_v1.md
docs/codex_skills/
```

If this design reference conflicts with API, data, ownership, or structural contracts, the contracts win.

---

## 2. Product positioning

Sendwise should feel like:

```txt
technical SaaS
premium dashboard
operational control panel
deliverability-focused platform
```

The UI should not feel like:

```txt
consumer email app
generic admin template
playground/demo toy
overdecorated marketing site
```

Design tone:

```txt
calm
precise
trustworthy
operational
premium but not flashy
```

---

## 3. Core visual direction

Sendwise uses a muted mint/green/olive palette.

Approved palette:

```txt
Neutral:       #CACFD6
Pale mint:     #D6E5E3
Aqua accent:   #9FD8CB
Primary green: #517664
Deep olive:    #2D3319
```

### Token mapping

```txt
Primary:        #517664
Primary hover:  #3F5F50
Primary soft:   #D6E5E3

Accent:         #9FD8CB
Accent strong:  #7FC7B7

Neutral:        #CACFD6
Neutral text:   #667076

Dark:           #2D3319
Dark surface:   #202716
Dark deeper:    #11150B
```

---

## 4. Light mode direction

Light mode should feel clean, spacious, and controlled.

Recommended usage:

```txt
App background:      #F7FAF9 or very pale mint
Sidebar background:  #FFFFFF or #F4F8F7
Card background:     #FFFFFF
Card border:         #CACFD6
Muted surface:       #D6E5E3
Primary action:      #517664
Accent highlight:    #9FD8CB
Main text:           #1F2618
Muted text:          #667076
```

Avoid:

```txt
pure saturated green everywhere
heavy shadows
too many gradients
large colored backgrounds inside data-heavy pages
```

---

## 5. Dark mode direction

Dark mode must reuse the same palette, adapted darker.

Recommended usage:

```txt
App background:      #11150B
Sidebar background:  #171D10
Card background:     #202716
Elevated surface:    #2D3319
Primary/accent:      #9FD8CB
Primary hover:       #B7E5DC
Text:                #EEF5F2
Muted text:          #B8C7C2
Border:              rgba(214, 229, 227, 0.16)
```

Dark mode must not use pure black as the dominant color.

Avoid:

```txt
#000000 as main background
high-neon cyber styling
low contrast text
green-on-green combinations with poor readability
```

---

## 6. Typography

Primary UI font:

```txt
Geist Sans
```

Use for:

```txt
navigation
dashboard labels
body text
tables
buttons
forms
badges
metrics
```

Secondary serif font:

```txt
Recommended: Newsreader or Source Serif 4
```

Use sparingly for:

```txt
login headline
empty-state headline
onboarding title
premium product messaging
```

Do not use serif fonts for:

```txt
tables
numbers
navigation
dense dashboard content
forms
technical labels
```

Typography should remain restrained.

Suggested hierarchy:

```txt
Page title:       large, semibold
Section title:    medium, semibold
Card title:       small/medium, medium
Metric value:     large, semibold
Body text:        regular
Muted text:       small, regular
Badge text:       small, medium
```

---

## 7. Layout rules

### Desktop

Preferred final layout:

```txt
left sidebar
top header area
main content area
```

Sidebar:

```txt
fixed or sticky on desktop
contains Admin/Client navigation
uses compact spacing
does not contain business logic
```

Main content:

```txt
max-width controlled where useful
clear page header
cards grouped in grids
tables compact and simple
```

### Mobile

Preferred final layout:

```txt
top header
hamburger button
left-side sheet/drawer navigation
```

The mobile navigation should use a left sheet/drawer pattern.

Do not build custom complex mobile nav if shadcn `sheet` can support it.

---

## 8. Density rules

Use a hybrid density model:

```txt
overview pages: airy
tables: compact and simple
forms: clear and spaced
settings: grouped and readable
```

Overview pages should not feel crowded.

Tables should not waste space.

Use:

```txt
card grids
short section descriptions
simple metric cards
compact lists
clear empty states
```

Avoid:

```txt
large dashboards with too many panels at once
charts before data contracts exist
deep nested cards
large decorative illustrations
```

---

## 9. Component strategy

Sendwise uses shadcn/ui as the baseline component system.

Initial approved shadcn components:

```txt
button
card
badge
input
label
select
separator
alert
dropdown-menu
sheet
```

Do not add more shadcn components unless a task explicitly requires them.

Not approved yet:

```txt
table
dialog
form
command
calendar
chart
toast
tabs
accordion
popover
```

These can be added later with separate scoped tasks.

---

## 10. Existing custom primitives

Current custom primitives may exist:

```txt
DashboardCard
SectionHeader
EmptyState
StatusBadge
AppShell
MainNav
MockLoginForm
```

Rules:

```txt
Do not rewrite them opportunistically.
Do not replace them all at once.
Do not create a UI migration monolith.
```

If moving custom primitives toward shadcn/ui, do it in small tasks.

Preferred sequence:

```txt
1. install shadcn baseline
2. document design reference
3. add dark mode
4. refactor one primitive at a time only when needed
```

---

## 11. Page composition rules

Required frontend pattern:

```txt
page
→ feature/presentational section
→ API boundary if data is needed
→ types
```

Allowed:

```txt
page imports from frontend/lib/api.ts
page composes small UI components
components receive data via props
components render only presentation
```

Forbidden:

```txt
page imports frontend/lib/mock-api.ts directly
page calls listmonk
page calls PostgreSQL
page implements tenant security
page implements deliverability decisions
page implements sending logic
page implements AI generation
page contains large business logic
```

---

## 12. Data boundary rules

Dashboard data must flow through:

```txt
frontend/lib/api.ts
```

Mock data can exist in:

```txt
frontend/lib/mock-api.ts
```

Pages and components must not import mock data directly.

Correct:

```txt
page → frontend/lib/api.ts → frontend/lib/mock-api.ts → frontend/types
```

Incorrect:

```txt
page → frontend/lib/mock-api.ts
component → frontend/lib/mock-api.ts
page → fetch(...)
component → fetch(...)
```

Direct `fetch()` calls are allowed only inside the approved API boundary file:

```txt
frontend/lib/api.ts
```

---

## 13. Auth and tenant boundary

Current auth state:

```txt
mock-only frontend login
no real auth
no route protection
no backend auth integration
```

Rules:

```txt
Do not store credentials.
Do not store tokens.
Do not use cookies for auth.
Do not use localStorage/sessionStorage for auth.
Do not implement tenant isolation in frontend as source of truth.
Do not protect routes in frontend as if it were real security.
```

Allowed only for frontend UI preference:

```txt
localStorage theme = light/dark
```

Not allowed:

```txt
localStorage token
localStorage role
localStorage client_id
sessionStorage auth
document.cookie auth
```

Real auth and tenant enforcement belong to backend/auth contracts.

---

## 14. Mock mode indication

While auth and data are mock-backed, the UI must clearly show a mock indicator.

Recommended wording:

```txt
Mock mode: frontend-only auth / mock data
```

This indicator is presentational only.

It must not include:

```txt
toggles
state changes
security implications
environment switching
real feature flags
```

---

## 15. Badge rules

Generic badge variants:

```txt
neutral
success
warning
danger
```

Suggested usage:

```txt
neutral: informational, mock mode, draft
success: healthy, active, ready
warning: paused, attention, rate limited
danger: blocked, failed, critical
```

Do not encode full Sendwise business state mapping unless the task explicitly asks for state mapping.

State mapping must follow:

```txt
docs/states_v1.md
```

---

## 16. Button rules

Use buttons conservatively.

Primary button:

```txt
main confirmed action
```

Secondary button:

```txt
navigation or low-risk action
```

Destructive button:

```txt
dangerous future action only when backend behavior exists
```

In mock-only frontend pages:

```txt
Do not add buttons that imply real backend behavior.
Do not add pause/resume/send/archive buttons until backend contracts and behavior exist.
```

Allowed mock login button:

```txt
Enter dashboard
```

because it is explicitly mock-only.

---

## 17. Card rules

Cards should be:

```txt
rounded
subtle border
minimal shadow
clear title
optional description
single responsibility
```

Cards must not:

```txt
fetch data
contain business logic
contain nested unrelated widgets
become mini dashboards
```

Metric card structure:

```txt
title
value
short description
optional status/badge
```

---

## 18. Empty state rules

Empty states should be clear and operational.

Good examples:

```txt
No campaigns available yet.
No blocked sends in this mock dataset.
Usage data will appear here when backend contracts are approved.
```

Avoid:

```txt
cute/irrelevant copy
large illustrations
buttons for backend features that do not exist
```

---

## 19. Tables

Tables are approved conceptually but not yet installed as shadcn components.

When table work begins:

```txt
keep compact
clear headers
no excessive borders
no heavy zebra striping
no inline business actions unless backend supports them
```

Tables should be used for:

```txt
campaign lists
clients
blocked sends
usage rows
provider events
```

Do not add tables before the relevant typed data shape exists.

---

## 20. Dark mode settings

Future dark mode implementation should use:

```txt
class-based dark mode
Tailwind-compatible approach
small settings control
```

Allowed persistence:

```txt
localStorage theme preference only
```

Forbidden persistence:

```txt
auth role
client_id
token
session
credentials
```

Theme switch should live in:

```txt
settings UI
or header/settings dropdown
```

Do not implement dark mode as a side effect of login/auth.

---

## 21. Accessibility baseline

Minimum expectations:

```txt
semantic HTML where practical
buttons for actions
links for navigation
labels for inputs
visible focus states
sufficient color contrast
no color-only status communication
keyboard usable dropdowns/sheets via shadcn primitives
```

Forms must use labels.

Badges should have readable text.

Interactive elements must not be div-only controls.

---

## 22. Animation

Use minimal motion.

Allowed:

```txt
small hover transitions
sheet open/close from shadcn
subtle focus/active states
```

Avoid:

```txt
large animated dashboards
loading gimmicks
motion that slows operations
```

---

## 23. Copywriting style

Use operational, precise language.

Preferred:

```txt
Admin overview
Client overview
Campaign health
Blocked sends
Usage this month
Operational notes
Mock data
Frontend-only auth
```

Avoid:

```txt
growth-hack language
overly playful labels
misleading production claims
```

Do not imply a feature is real if it is mock-backed.

---

## 24. Anti-monolith UI rules

Do not create:

```txt
AdminDashboard.tsx with everything inside
ClientDashboard.tsx with everything inside
Large page files with multiple business concerns
Components that fetch and render and decide policy
```

Prefer:

```txt
small presentational components
one responsibility per component
data access through api.ts
typed props
clear page composition
```

If a component starts to handle more than one responsibility, split it.

---

## 25. Task discipline

Every frontend prompt must specify:

```txt
task type
implementation depth
task budget
allowed scope
forbidden scope
tests required
stop conditions
output required
```

For design-related tasks, include this file as source:

```txt
docs/frontend_design_reference_v1.md
```

For any feature/fix touching structure, also apply:

```txt
docs/codex_skills/check-anti-monolith.md
docs/codex_skills/run-regression-guard.md
```

---

## 26. Stop conditions

Stop and request approval if a frontend task requires:

```txt
backend changes
API contract changes
DB schema changes
Docker changes
new auth behavior
tenant security logic
new data model
new shadcn components outside the approved list
broad UI redesign
global styling rewrite
```

For API/data shape changes, output:

```txt
CONTRACT CHANGE REQUEST
```

For runtime/tooling blockers, output:

```txt
INFRASTRUCTURE BLOCKER
```

---

## 27. Current approved design direction summary

```txt
Product: SaaS tecnico + dashboard premium
Palette: mint / aqua / green / deep olive
Light mode: clean, airy, white/mint
Dark mode: deep olive, not pure black
Typography: Geist UI + limited serif headings
Layout: sidebar desktop, left sheet hamburger mobile
Components: shadcn/ui baseline
Cards: rounded, subtle border, minimal shadow
Dashboard: airy overview, compact tables
Tone: technical, operational, clear
```