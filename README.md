# PTPM React App

PTPM React App is the current React frontend for the PTPM workflow. It covers inquiry intake, job operations, quote and invoice handling, service-provider allocation, uploads, activities, appointments, tasks, notifications, and a public quote acceptance page.

The app talks to VitalStats through the browser SDK, which is loaded at runtime and attached to `window.__ptpmVitalStatsPlugin`.

## Stack

- React 18
- Vite 5
- Tailwind CSS 3
- React Router 7
- JavaScript (no TypeScript)

## Current Feature Set

- Operational dashboard with tabs, filters, sorting, pagination, calendar data, export, and batch actions
- Inquiry details page for intake, account and property editing, related records, uploads, appointments, activities, tasks, memos, and linked-job creation
- Job details page for allocation, status management, quote and payment workflow, invoice workflow, related data, uploads, appointments, activities, materials, and tasks
- Public quote page at `/quote/:uid` that mirrors the job-details quote sheet and supports quote acceptance
- Profile, settings, notifications, announcements, and recent activity tracking

## Route Map

Defined in [src/app/App.jsx](/home/dpes/projects/ptpm_react_app/src/app/App.jsx).

### Active routes

- `/` -> `DashboardPage`
- `/inquiry-details/new` -> `InquiryDetailsPage`
- `/inquiry-details/:uid` -> `InquiryDetailsPage`
- `/job-details/new` -> `JobDetailsPage`
- `/job-details/:uid` -> `JobDetailsPage`
- `/quote/:uid` -> `PublicJobSheetPage`
- `/profile` -> `ProfilePage`
- `/settings` -> `SettingsPage`
- `/notifications` -> `NotificationsPage`

### Legacy redirects

- `/inquiry-direct` -> `/inquiry-details/new`
- `/inquiry-direct/new` -> `/inquiry-details/new`
- `/inquiry-direct/:inquiryuid` -> `/inquiry-details/:uid`
- `/details/:uid` -> `/job-details/:uid`
- `/job-direct` -> `/`
- `/job-direct/:jobuid` -> `/job-details/:jobuid`

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

The dev server defaults to `http://localhost:5173`.

## Environment Variables

Documented in code today:

- `VITE_APP_USER_ID`
- `VITE_VITALSTATS_SLUG`
- `VITE_VITALSTATS_API_KEY`
- `VITE_VITALSTATS_UPLOAD_ENDPOINT`
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_ENABLE_STRICT_MODE`
- `VITE_APP_USER_ADMIN_ID`
- `VITE_PRELOAD_ALL_PROPERTIES`
- `VITE_INQUIRY_LINK_BASE`

Notes:

- `.env.example` currently contains only the first five variables.
- `VITE_APP_USER_ADMIN_ID` is used to auto-fill `job_taken_by` on job details when missing.
- `VITE_ENABLE_STRICT_MODE=true` forces React strict mode in development. Production always uses strict mode.
- `VITE_PRELOAD_ALL_PROPERTIES=true` changes property-loading behavior in inquiry details.
- `VITE_INQUIRY_LINK_BASE` is used when generating inquiry links from shared job-info utilities.

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run lint:boundaries
```

## Verification

Primary verification:

```bash
npm run build
```

Boundary lint is available, but the repository currently has known existing violations in feature code, so:

```bash
npm run lint:boundaries
```

is expected to fail until those imports are cleaned up.

There is no automated unit or integration test suite in this repository at the moment.

## Architecture

### App composition

- Entry: [src/main.jsx](/home/dpes/projects/ptpm_react_app/src/main.jsx)
- Router shell: [src/app/App.jsx](/home/dpes/projects/ptpm_react_app/src/app/App.jsx)
- Global providers:
  - [src/shared/providers/ToastProvider.jsx](/home/dpes/projects/ptpm_react_app/src/shared/providers/ToastProvider.jsx)
  - [src/shared/providers/CurrentUserProfileProvider.jsx](/home/dpes/projects/ptpm_react_app/src/shared/providers/CurrentUserProfileProvider.jsx)
  - [src/shared/providers/AnnouncementsProvider.jsx](/home/dpes/projects/ptpm_react_app/src/shared/providers/AnnouncementsProvider.jsx)
- Shared dock:
  - [src/shared/components/RecentActivitiesDock.jsx](/home/dpes/projects/ptpm_react_app/src/shared/components/RecentActivitiesDock.jsx)

### Source layout

```text
src/
  app/                  Router shell
  features/             Page-level features and workflows
  modules/              Reusable business modules and SDK helpers
  platform/             VitalStats bootstrap and platform integration
  shared/               UI primitives, providers, hooks, utils, layout
```

### Aliases

Defined in [vite.config.js](/home/dpes/projects/ptpm_react_app/vite.config.js):

- `@features`
- `@modules`
- `@platform`
- `@shared`

### Boundary rules

- Features should not import other features.
- Modules should not import from features.
- Outside a module, prefer public entrypoints over deep imports.

Primary public entrypoints:

- [src/modules/job-workspace/public/components.js](/home/dpes/projects/ptpm_react_app/src/modules/job-workspace/public/components.js)
- [src/modules/job-workspace/public/hooks.js](/home/dpes/projects/ptpm_react_app/src/modules/job-workspace/public/hooks.js)
- [src/modules/job-workspace/public/constants.js](/home/dpes/projects/ptpm_react_app/src/modules/job-workspace/public/constants.js)
- [src/modules/job-workspace/public/sdk.js](/home/dpes/projects/ptpm_react_app/src/modules/job-workspace/public/sdk.js)
- [src/modules/job-records/public/sdk.js](/home/dpes/projects/ptpm_react_app/src/modules/job-records/public/sdk.js)

## VitalStats Integration

Core files:

- [src/platform/vitalstats/bootstrap.js](/home/dpes/projects/ptpm_react_app/src/platform/vitalstats/bootstrap.js)
- [src/platform/vitalstats/config.js](/home/dpes/projects/ptpm_react_app/src/platform/vitalstats/config.js)
- [src/platform/vitalstats/useVitalStatsPlugin.js](/home/dpes/projects/ptpm_react_app/src/platform/vitalstats/useVitalStatsPlugin.js)

Behavior:

- Dynamically loads the VitalStats SDK script at runtime
- Calls `window.initVitalStats(...)`
- Stores the resolved plugin on `window.__ptpmVitalStatsPlugin`
- Uses defensive payload extraction because VitalStats responses vary between query, fetch, calc, and subscription paths

Common models used by the app:

- `PeterpmJob`
- `PeterpmDeal`
- `PeterpmAppointment`
- `PeterpmActivity`
- `PeterpmMaterial`
- `PeterpmTask`
- `PeterpmUpload`
- `PeterpmProperty`
- `PeterpmServiceProvider`
- `PeterpmContact`
- `PeterpmCompany`
- `PeterpmAnnouncement`

## Key Pages

### Dashboard

- Page: [src/features/dashboard/pages/DashboardPage.jsx](/home/dpes/projects/ptpm_react_app/src/features/dashboard/pages/DashboardPage.jsx)
- Data layer: [src/features/dashboard/sdk/dashboardSdk.js](/home/dpes/projects/ptpm_react_app/src/features/dashboard/sdk/dashboardSdk.js)
- Hooks:
  - [src/features/dashboard/hooks/useDashboardBootstrap.js](/home/dpes/projects/ptpm_react_app/src/features/dashboard/hooks/useDashboardBootstrap.js)
  - [src/features/dashboard/hooks/useDashboardData.js](/home/dpes/projects/ptpm_react_app/src/features/dashboard/hooks/useDashboardData.js)
  - [src/features/dashboard/hooks/useDashboardFilters.js](/home/dpes/projects/ptpm_react_app/src/features/dashboard/hooks/useDashboardFilters.js)

### Inquiry Details

- Page: [src/features/inquiry-details/pages/InquiryDetailsPage.jsx](/home/dpes/projects/ptpm_react_app/src/features/inquiry-details/pages/InquiryDetailsPage.jsx)
- This is a large orchestration page and is the main source of truth for many detail-page UI patterns.

### Job Details

- Page: [src/features/job-details/pages/JobDetailsPage.jsx](/home/dpes/projects/ptpm_react_app/src/features/job-details/pages/JobDetailsPage.jsx)
- Quote sheet UI is driven by [src/modules/job-workspace/components/sections/invoice/QuoteSheetPanel.jsx](/home/dpes/projects/ptpm_react_app/src/modules/job-workspace/components/sections/invoice/QuoteSheetPanel.jsx)

### Public Quote Page

- Page: [src/features/job-details/pages/PublicJobSheetPage.jsx](/home/dpes/projects/ptpm_react_app/src/features/job-details/pages/PublicJobSheetPage.jsx)
- Route: `/quote/:uid`
- This page should stay visually and data-wise aligned with the Quote tab in the job details page.

### Account Pages

- [src/features/account/pages/ProfilePage.jsx](/home/dpes/projects/ptpm_react_app/src/features/account/pages/ProfilePage.jsx)
- [src/features/account/pages/SettingsPage.jsx](/home/dpes/projects/ptpm_react_app/src/features/account/pages/SettingsPage.jsx)
- [src/features/account/pages/NotificationsPage.jsx](/home/dpes/projects/ptpm_react_app/src/features/account/pages/NotificationsPage.jsx)

## State and Data Flow

### Job workspace store

The job workspace uses a custom reducer store, not Redux.

Core files:

- [src/modules/job-workspace/hooks/useJobDirectStore.jsx](/home/dpes/projects/ptpm_react_app/src/modules/job-workspace/hooks/useJobDirectStore.jsx)
- [src/modules/job-workspace/state/reducer.js](/home/dpes/projects/ptpm_react_app/src/modules/job-workspace/state/reducer.js)
- [src/modules/job-workspace/state/actions.js](/home/dpes/projects/ptpm_react_app/src/modules/job-workspace/state/actions.js)
- [src/modules/job-workspace/state/selectors.js](/home/dpes/projects/ptpm_react_app/src/modules/job-workspace/state/selectors.js)
- [src/modules/job-workspace/state/derivedSelectors.js](/home/dpes/projects/ptpm_react_app/src/modules/job-workspace/state/derivedSelectors.js)

### Shared SDK layers

- Job and inquiry detail helpers:
  - [src/modules/job-records/sdk/jobDetailsSdk.js](/home/dpes/projects/ptpm_react_app/src/modules/job-records/sdk/jobDetailsSdk.js)
- Reusable workspace runtime exports:
  - [src/modules/job-workspace/sdk/core/runtime.js](/home/dpes/projects/ptpm_react_app/src/modules/job-workspace/sdk/core/runtime.js)
- Shared dashboard transport helpers:
  - [src/shared/sdk/dashboardCore.js](/home/dpes/projects/ptpm_react_app/src/shared/sdk/dashboardCore.js)

### Related records

Shared hook:

- [src/features/inquiry/shared/useRelatedRecordsData.js](/home/dpes/projects/ptpm_react_app/src/features/inquiry/shared/useRelatedRecordsData.js)

Behavior:

- Loads related inquiries and jobs in parallel
- Uses in-memory and localStorage caching
- Used by both inquiry details and job details

## Important Development Notes

- Internal navigation should use `navigate()` from React Router, not `window.open()`.
- VitalStats field casing is inconsistent. Always normalize with fallbacks.
- For activity booleans, prefer:

```js
raw?.include_in_quote ?? raw?.Include_in_Quote ?? raw?.Include_In_Quote
```

- Do not use `||` where `false` or `0` are valid values. Use `??` when appropriate.
- If you change quote-sheet layout or header data, compare both:
  - `/job-details/:uid` Quote tab
  - `/quote/:uid`

## Known Gaps

- Boundary lint currently fails due existing cross-feature and deep-import violations in feature pages.
- `.env.example` does not list every runtime-used variable.
- There is no automated test suite.
- Some pages are still large monoliths, especially:
  - [src/features/inquiry-details/pages/InquiryDetailsPage.jsx](/home/dpes/projects/ptpm_react_app/src/features/inquiry-details/pages/InquiryDetailsPage.jsx)
  - [src/features/job-details/pages/JobDetailsPage.jsx](/home/dpes/projects/ptpm_react_app/src/features/job-details/pages/JobDetailsPage.jsx)

## Recommended Read Order

If you are new to the repo, start here:

1. [src/app/App.jsx](/home/dpes/projects/ptpm_react_app/src/app/App.jsx)
2. [src/main.jsx](/home/dpes/projects/ptpm_react_app/src/main.jsx)
3. [src/features/dashboard/pages/DashboardPage.jsx](/home/dpes/projects/ptpm_react_app/src/features/dashboard/pages/DashboardPage.jsx)
4. [src/features/inquiry-details/pages/InquiryDetailsPage.jsx](/home/dpes/projects/ptpm_react_app/src/features/inquiry-details/pages/InquiryDetailsPage.jsx)
5. [src/features/job-details/pages/JobDetailsPage.jsx](/home/dpes/projects/ptpm_react_app/src/features/job-details/pages/JobDetailsPage.jsx)
6. [src/features/job-details/pages/PublicJobSheetPage.jsx](/home/dpes/projects/ptpm_react_app/src/features/job-details/pages/PublicJobSheetPage.jsx)
