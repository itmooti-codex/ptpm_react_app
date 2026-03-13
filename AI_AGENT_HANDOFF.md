# PTPM React App - AI Agent Handoff

Last updated: 2026-03-13

This file is the practical handoff for AI agents working in this repository.

---

## 1) Project Summary

- Project: `ptpm-react-app`
- Stack: React 18, Vite 5, Tailwind CSS 3, React Router 7
- Language: JavaScript (no TypeScript)
- Backend: VitalStats browser SDK, loaded at runtime
- Main product areas:
  - inquiry intake and conversion
  - job operations and service-provider allocation
  - quote and invoice workflow
  - uploads, activities, materials, appointments, tasks
  - notifications, announcements, recent activity
  - public quote acceptance

---

## 2) How to Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Verification after changes:

```bash
npm run build          # must pass
npm run lint           # must pass (runs lint:boundaries + lint:max-lines)
```

No automated unit or integration test suite exists. `npm run build` is the primary correctness check.

---

## 3) Environment Variables

All runtime-used variables:

| Variable | Purpose |
|---|---|
| `VITE_APP_USER_ID` | Current logged-in user ID |
| `VITE_VITALSTATS_SLUG` | VitalStats account slug |
| `VITE_VITALSTATS_API_KEY` | VitalStats API key |
| `VITE_VITALSTATS_UPLOAD_ENDPOINT` | Upload endpoint URL |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key |
| `VITE_ENABLE_STRICT_MODE` | Enable React strict mode in dev (production always uses strict) |
| `VITE_APP_USER_ADMIN_ID` | Admin user ID — used for `job_taken_by` auto-fill |
| `VITE_PRELOAD_ALL_PROPERTIES` | Preload all properties for search in inquiry-details |
| `VITE_INQUIRY_LINK_BASE` | Base URL for inquiry links shown in job-info utilities |

Note: `.env.example` currently only lists the first five. Add the rest to `.env.local` manually.

---

## 4) Current Route Map

Defined in `src/app/App.jsx`.

### Active routes

| Path | Component |
|---|---|
| `/` | `DashboardPage` |
| `/inquiry-details/new` | `InquiryDetailsPage` |
| `/inquiry-details/:uid` | `InquiryDetailsPage` |
| `/job-details/new` | `JobDetailsPage` |
| `/job-details/:uid` | `JobDetailsPage` |
| `/quote/:uid` | `PublicJobSheetPage` |
| `/profile` | `ProfilePage` |
| `/settings` | `SettingsPage` |
| `/notifications` | `NotificationsPage` |

### Legacy redirect routes (redirect only, no components)

- `/inquiry-direct` → `/inquiry-details/new`
- `/inquiry-direct/new` → `/inquiry-details/new`
- `/inquiry-direct/:uid` → `/inquiry-details/:uid`
- `/details/:uid` → `/job-details/:uid`
- `/job-direct` → `/`
- `/job-direct/:uid` → `/job-details/:uid`

---

## 5) Architecture

### 5.1 Layer model

```
src/features/*      → pages and feature-specific workflows
src/modules/*       → reusable business modules (workspace UI, API domains)
src/shared/*        → UI primitives, providers, hooks, constants, utilities
src/platform/*      → VitalStats bootstrap and platform integration
```

Path aliases:

- `@features/*` → `src/features/*`
- `@modules/*` → `src/modules/*`
- `@platform/*` → `src/platform/*`
- `@shared/*` → `src/shared/*`

### 5.2 Module public entrypoints

From outside a module always import via the module's `exports/` files:

| Module | Entrypoints |
|---|---|
| `details-workspace` | `@modules/details-workspace/exports/api.js` |
| | `@modules/details-workspace/exports/components.js` |
| | `@modules/details-workspace/exports/hooks.js` |
| | `@modules/details-workspace/exports/constants.js` |
| `job-records` | `@modules/job-records/exports/api.js` |

Never import from deep internal paths like `@modules/details-workspace/api/core/...`.

### 5.3 Boundary rules (enforced by `npm run lint:boundaries`)

- Features must not import from other features
- Modules must not import from features
- Cross-module imports must use the target module's `exports/*.js` entrypoints
- `npm run lint:boundaries` must pass with 0 violations

---

## 6) VitalStats Integration

Core files:

- `src/platform/vitalstats/bootstrap.js` — `ensureVitalStatsPlugin()`, stores on `window.__ptpmVitalStatsPlugin`
- `src/platform/vitalstats/config.js`
- `src/platform/vitalstats/useVitalStatsPlugin.js`

Transport helpers (import from `@modules/details-workspace/exports/api.js`):

- `toPromiseLike(result)` — wraps Promise/Observable/`.toPromise()` into a real Promise
- `fetchDirectWithTimeout(query, options?, timeoutMs?)` — `fetchDirect` with 30s default timeout
- `subscribeToQueryStream(query, { onNext, onError })` — returns cleanup function

VitalStats model names: `PeterpmJob`, `PeterpmDeal`, `PeterpmAppointment`, `PeterpmActivity`, `PeterpmMaterial`, `PeterpmTask`, `PeterpmUpload`, `PeterpmProperty`, `PeterpmServiceProvider`, `PeterpmService`, `PeterpmContact`, `PeterpmCompany`, `PeterpmAnnouncement`

**Critical data caveat:** Subscription field casing is inconsistent. Always normalize with fallbacks:

```js
raw?.include_in_quote ?? raw?.Include_in_Quote ?? raw?.Include_In_Quote
```

---

## 7) State

### 7.1 Workspace store (details-workspace)

Custom context + reducer (not Redux). Used by all workspace screens (job-details and inquiry-details).

Core files:

- `src/modules/details-workspace/hooks/useDetailsWorkspaceStore.jsx` — store context and provider
- `src/modules/details-workspace/state/reducer.js`
- `src/modules/details-workspace/state/actions.js`
- `src/modules/details-workspace/state/initialState.js`
- `src/modules/details-workspace/state/selectors.js`
- `src/modules/details-workspace/state/derivedSelectors.js`

Key hooks (exported from the store file):

- `DetailsWorkspaceStoreProvider` — wrap screens that need workspace state
- `useDetailsWorkspaceSelector(selector)` — read from store
- `useDetailsWorkspaceStoreActions()` — get action dispatchers

Important reducer behavior: `HYDRATE_BOOTSTRAP` preserves `true` for certain activity boolean fields when stale subscription data briefly reports `false`.

### 7.2 Dashboard data flow

Primary files:

- `src/features/dashboard/pages/DashboardPage.jsx` — thin shell
- `src/features/dashboard/hooks/useDashboardPageState.js` — main state orchestrator
- `src/features/dashboard/api/dashboardQueries.js` — query builders
- `src/features/dashboard/api/dashboardMutations.js` — create/update/cancel operations
- `src/features/dashboard/api/dashboardCounting.js` — count aggregations
- `src/features/dashboard/api/dashboardNormalizers.js` — record normalization

### 7.3 User profile, notifications, recent activity

- `src/shared/providers/CurrentUserProfileProvider.jsx`
- `src/shared/providers/AnnouncementsProvider.jsx`
- `src/shared/components/RecentActivitiesDock.jsx`

---

## 8) Main Feature Surfaces

### 8.1 Dashboard

- `src/features/dashboard/pages/DashboardPage.jsx` — entry point
- Multiple operational tabs with filtering, sorting, pagination, calendar, export, batch delete

### 8.2 Inquiry Details

- `src/features/inquiry-details/pages/InquiryDetailsPage.jsx` — entry point
- `src/features/inquiry-details/components/InquiryDetailsScreen.jsx` — screen orchestrator

Key field mappings:
- `inquiry.quote_record_id` → linked quote job
- `inquiry.inquiry_for_job_id` → job linked from related-record selection

### 8.3 Job Details

- `src/features/job-details/pages/JobDetailsPage.jsx` — entry point
- `src/features/job-details/components/JobDetailsScreen.jsx` — screen orchestrator
- `src/features/job-details/components/JobDetailsBodySection.jsx` — workspace sections

Key field mappings:
- `job.inquiry_record_id` → primary linked inquiry
- `Job_Taken_By_id` / `job_taken_by_id` / `Job_Taken_By_ID` → possible `job_taken_by` aliases

Key capabilities: service-provider allocation, PCA/Prestart/Mark Complete, invoice and quote workflow, print job sheet, quote send/accept, uploads, appointments, activities, materials, tasks.

### 8.4 Public Quote Page

- `src/features/job-details/pages/PublicJobSheetPage.jsx` — route `/quote/:uid`
- Shared render component: `src/modules/details-workspace/components/sections/invoice/QuoteSheetPanel.jsx`

**Maintenance rule:** When changing quote header, totals, accept flow, or quote table rendering, update **both** `JobDetailsPage` (Quote tab) and `PublicJobSheetPage`. They share `QuoteSheetPanel` but the surrounding data-loading differs.

### 8.5 Account pages

- `src/features/account/pages/ProfilePage.jsx`
- `src/features/account/pages/SettingsPage.jsx`
- `src/features/account/pages/NotificationsPage.jsx`

---

## 9) API and CRUD Patterns

See `CRUD_PATTERNS.md` at the project root for the full standard pattern reference.

Quick summary:
- **Fetch:** guard → build query → `fetchDirectWithTimeout` → normalize → catch silently → return empty
- **Mutate:** validate → normalize → `toPromiseLike(mutation.execute(true))` → check `isCancelling` → check `extractStatusFailure` → throw on failure
- **Subscribe:** guard → `subscribeToQueryStream` → return cleanup function
- **Hooks:** `useEffect` for subscriptions with cleanup, loading/error state with `useState`, toast on mutation success/failure

Components must never call API functions directly — always go through a hook.

---

## 10) File Size Rule

All source files must stay under 500 lines. Enforced by `npm run lint:max-lines`.

If a file needs to grow past 500 lines, split it first:
- Extract constants → `*Constants.js` or `*Schema.js`
- Extract utilities → `*Utils.js`
- Extract hooks → `use*.js`
- Extract sub-components → `*Panel.jsx`, `*Fields.jsx`
- Keep the main file as a thin orchestrator

---

## 11) What Not To Do

- Do not deep-import from module internals — use `exports/*.js` entrypoints
- Do not import across feature boundaries — move shared code to `modules/` or `shared/`
- Do not define `toText`, `toPromiseLike`, or other shared utilities locally — import from `@shared/utils/formatters.js` or `@modules/details-workspace/exports/api.js`
- Do not use `window.open` for internal navigation — use `useNavigate()`
- Do not assume one VitalStats field casing without fallbacks
- Do not use `||` where `false` or `0` are valid and meaningful
- Do not change quote-sheet behavior in only one of the two quote surfaces
- Do not add a source file over 500 lines without splitting it first

---

## 12) Files to Read First

| Goal | Files |
|---|---|
| App shell and routes | `src/main.jsx`, `src/app/App.jsx` |
| Dashboard work | `src/features/dashboard/pages/DashboardPage.jsx`, `src/features/dashboard/hooks/useDashboardPageState.js` |
| Inquiry work | `src/features/inquiry-details/pages/InquiryDetailsPage.jsx`, `src/features/inquiry-details/components/InquiryDetailsScreen.jsx` |
| Job work | `src/features/job-details/pages/JobDetailsPage.jsx`, `src/features/job-details/components/JobDetailsScreen.jsx` |
| Public quote | `src/features/job-details/pages/PublicJobSheetPage.jsx`, `src/modules/details-workspace/components/sections/invoice/QuoteSheetPanel.jsx` |
| Workspace sections | `@modules/details-workspace/exports/components.js` |
| Workspace store | `src/modules/details-workspace/hooks/useDetailsWorkspaceStore.jsx` |
| Job API | `src/modules/job-records/exports/api.js` |
| Transport helpers | `@modules/details-workspace/exports/api.js` |
| CRUD patterns | `CRUD_PATTERNS.md` |

---

## 13) Quick Start Checklist

1. Read this file.
2. Check `src/app/App.jsx` for the live route map.
3. For job work: `JobDetailsPage.jsx` → `JobDetailsScreen.jsx` → `JobDetailsBodySection.jsx`.
4. For inquiry work: `InquiryDetailsPage.jsx` → `InquiryDetailsScreen.jsx`.
5. For quote-sheet work: check both `JobDetailsPage` and `PublicJobSheetPage`.
6. Confirm `.env.local` has all needed variables (see section 3).
7. Run `npm run build` after meaningful changes.
8. Run `npm run lint` — both `lint:boundaries` and `lint:max-lines` must pass.
