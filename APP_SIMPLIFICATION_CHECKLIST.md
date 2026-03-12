# App Simplification Checklist

Purpose: keep the app simple, boring, and easy to understand while refactoring toward a hard file-size target of no more than 500 lines per source file.

## Rules

- Keep one concern per file.
- Keep page files thin. Pages should mainly read route params, assemble sections, and pass props.
- Keep data access split by resource, not one large SDK file.
- Only share code when the behavior is truly the same.
- Prefer basic CRUD patterns with subscriptions only where they matter.
- Avoid clever abstractions and large local state machines.
- Rename files and folders so names match current app concepts, not deleted legacy flows.
- Remove unused files, folders, helpers, components, and dead exports aggressively.

## Current Baseline

- Largest file: `src/features/job-details/components/JobDetailsScreen.jsx`
- Inquiry screen reduction complete: `src/features/inquiry-details/components/InquiryDetailsScreen.jsx` (`411` lines) and `src/features/inquiry-details/components/InquiryDetailsScreenLayout.jsx` (`312` lines)
- Largest file: `src/modules/job-records/api/jobDetailsApi.js`
- Large section: `src/modules/details-workspace/components/sections/UploadsSection.jsx`
- Large modal: `src/modules/details-workspace/components/modals/ContactDetailsModal.jsx`
- Large section: `src/modules/details-workspace/components/sections/job-information/AppointmentTabSection.jsx`
- Large section: `src/modules/details-workspace/components/sections/job-information/PropertyTabSection.jsx`

## Target Folder Structure

The app should be organized by page-level feature first, then by concern inside each feature.

```text
src/
  app/
  shared/
    components/
      icons/
      ui/
    constants/
    hooks/
    layout/
    lib/
    providers/
    utils/
  features/
    dashboard/
      api/
      components/
      hooks/
      pages/
    inquiry-details/
      api/
      components/
      hooks/
      modals/
      pages/
      sections/
    job-details/
      api/
      components/
      hooks/
      modals/
      pages/
      sections/
    notifications/
      api/
      components/
      hooks/
      pages/
    profile/
      components/
      hooks/
      pages/
    quote/
      api/
      components/
      hooks/
      pages/
    settings/
      components/
      hooks/
      pages/
```

### Structure Rules

- `pages/` contains route entry files only.
- `sections/` contains major screen areas such as related data, notes, memos, contact logs, uploads, invoice, property, and appointments.
- `components/` contains smaller feature-specific UI pieces used by sections or pages.
- `hooks/` contains feature-specific state, side effects, subscriptions, and derived data logic.
- `api/` contains resource-based CRUD and subscription functions only.
- `modals/` contains one modal per file, plus small modal-specific helpers if needed.
- `shared/` contains only truly reusable UI and generic utilities with no job or inquiry business rules inside.

### Intended Direction From Current Structure

- Move large business-specific code out of `src/modules/details-workspace` into `src/features/job-details` or `src/features/inquiry-details` unless it is truly shared.
- Move large data-access files out of broad `sdk/` buckets into feature `api/` folders split by resource.
- Keep `dashboard`, `profile`, `settings`, `notifications`, and `quote` as thin feature folders with the same internal shape where needed.
- Remove old naming based on deleted flows such as `job-direct` as part of the naming cleanup phase.

## Naming Rules

### App-Wide Rules

- File and folder names must describe the current app concept, not a deleted or transitional implementation.
- Prefer names based on the user-facing feature: `job-details`, `inquiry-details`, `dashboard`, `notifications`, `profile`, `settings`, `quote`.
- Prefer names based on resource or behavior: `notes`, `memos`, `contact-logs`, `related-records`, `uploads`, `appointments`, `invoice`, `properties`.
- Avoid implementation-history names such as `direct`, `legacy`, `runtime`, `workspace`, or `sdk` unless that term is still truly the current product concept.
- Use the same term everywhere for the same thing. Do not mix multiple names for one concept.

### Folder Rules

- Feature folders should use lowercase kebab-case.
- Feature-internal folders should be one of: `pages`, `sections`, `components`, `hooks`, `api`, `modals`.
- `shared/` should contain only truly generic names and must not contain feature-specific business wording.
- Broad buckets like `sdk/`, `shared/`, or `utils/` inside a feature are only acceptable when the contents are genuinely narrow and clearly named. Prefer `api/`, `hooks/`, `sections/`, or specific filenames instead.

### File Rules

- React components use PascalCase filenames that match the exported component name.
- Hooks use `useXxx` naming and must describe one focused concern only.
- Data-access files should use resource naming such as `notesApi.js`, `memosApi.js`, `contactLogsApi.js`, `relatedRecordsApi.js`.
- Helper files must be named after the narrow domain they support, not generic names like `helpers.js` unless scoped by folder and still obvious.
- Files with `Legacy` in the name should be treated as temporary and either renamed or removed.

### Explicit Rename Targets

- Replace `job-direct` naming with current names based on actual usage.
- Replace broad `sdk` naming with `api` where the file is doing data access.
- Replace `inquiry/shared` style naming with clearer feature naming or move those files into `shared/` if they are truly cross-feature.
- Replace `job-workspace` naming where the code is actually job-details or inquiry-details specific.
- Replace generic names like `runtime`, `core`, `public`, and `utils` with clearer names when their contents are no longer low-level infrastructure.

### Decision Rule

- If a new developer cannot infer a file’s purpose from its path and filename alone, the name is not good enough.

## Oversized File Inventory

Current source files over 500 lines: 22

### Priority 0: Top-Level Control Files

These have the highest blast radius and create the most confusion because they mix rendering, state, side effects, data loading, subscriptions, and modal orchestration.

- `4380` `src/features/job-details/components/JobDetailsScreen.jsx`
- `2347` `src/modules/job-records/api/jobDetailsApi.js`

### Priority 1: Large Shared Workflow Sections

These are major CRUD work areas and should be split after the main page shells and central SDK are reduced.

- `1783` `src/modules/details-workspace/components/sections/UploadsSection.jsx`
- `1712` `src/modules/details-workspace/components/modals/ContactDetailsModal.jsx`
- `1548` `src/modules/details-workspace/components/sections/job-information/AppointmentTabSection.jsx`
- `1454` `src/modules/details-workspace/components/sections/job-information/PropertyTabSection.jsx`
- `1370` `src/features/dashboard/api/dashboardApi.js`
- `1224` `src/modules/details-workspace/components/sections/AddActivitiesSection.jsx`
- `1155` `src/modules/details-workspace/components/sections/InvoiceSection.jsx`
- `1061` `src/modules/details-workspace/components/sections/AddMaterialsSection.jsx`
- `932` `src/modules/details-workspace/components/modals/TasksModal.jsx`
- `796` `src/features/dashboard/pages/DashboardPage.jsx`

### Priority 2: Shared Infrastructure And Secondary Large Files

These still need reduction, but they should follow once the page shells and the biggest CRUD sections are simplified.

- `876` `src/shared/components/RecentActivitiesDock.jsx`
- `792` `src/shared/announcements/announcementEmitter.js`
- `730` `src/modules/details-workspace/components/modals/PropertyAffiliationModal.jsx`
- `637` `src/shared/providers/AnnouncementsProvider.jsx`
- `626` `src/modules/details-workspace/components/modals/AddPropertyModal.jsx`
- `605` `src/modules/details-workspace/components/sections/invoice/InvoicePanels.jsx`
- `584` `src/shared/components/ui/MemoChatPanel.jsx`
- `577` `src/modules/details-workspace/components/sections/JobInformationSection.jsx`
- `520` `src/features/account/pages/ProfilePage.jsx`
- `501` `src/modules/details-workspace/components/layout/DetailsWorkspaceLayout.jsx`

### Refactor Order Rule

- Reduce page shells and central data-access files before tuning secondary sections.
- Prefer deleting or moving code before splitting it.
- When a large file is mostly feature-specific, move it into that feature before reducing it further.

## Completed Rename Pass

The file-and-folder rename pass for legacy paths is complete. Old path groups were replaced with clearer current names and all imports were rewired.

### Completed Folder Renames

- `src/modules/job-workspace` -> `src/modules/details-workspace`
- `src/features/dashboard/sdk` -> `src/features/dashboard/api`
- `src/modules/job-records/sdk` -> `src/modules/job-records/api`
- `src/modules/job-records/public` -> `src/modules/job-records/exports`
- `src/modules/details-workspace/public` -> `src/modules/details-workspace/exports`
- `src/shared/sdk` -> `src/shared/api`
- `src/features/inquiry/shared` -> `src/features/inquiry-details/shared`

### Completed File Renames

- `src/features/dashboard/api/dashboardSdk.js` -> `src/features/dashboard/api/dashboardApi.js`
- `src/modules/job-records/api/jobDetailsSdk.js` -> `src/modules/job-records/api/jobDetailsApi.js`
- `src/modules/details-workspace/components/layout/JobDirectLayout.jsx` -> `src/modules/details-workspace/components/layout/DetailsWorkspaceLayout.jsx`
- `src/modules/details-workspace/components/layout/JobDirectContent.jsx` -> `src/modules/details-workspace/components/layout/DetailsWorkspaceContent.jsx`
- `src/modules/details-workspace/components/layout/JobDirectHeader.jsx` -> `src/modules/details-workspace/components/layout/DetailsWorkspaceHeader.jsx`
- `src/modules/details-workspace/components/layout/JobDirectSidebar.jsx` -> `src/modules/details-workspace/components/layout/DetailsWorkspaceSidebar.jsx`
- `src/modules/details-workspace/components/icons/JobDirectIcons.jsx` -> `src/modules/details-workspace/components/icons/WorkspaceIcons.jsx`
- `src/modules/details-workspace/components/modals/LegacyRuntimeModals.jsx` -> `src/modules/details-workspace/components/modals/WorkspaceRuntimeModals.jsx`
- `src/modules/details-workspace/components/primitives/JobDirectLayout.jsx` -> `src/modules/details-workspace/components/primitives/WorkspaceLayoutPrimitives.jsx`
- `src/modules/details-workspace/components/primitives/JobDirectTable.jsx` -> `src/modules/details-workspace/components/primitives/WorkspaceTablePrimitives.jsx`
- `src/modules/details-workspace/hooks/useJobDirectStore.jsx` -> `src/modules/details-workspace/hooks/useDetailsWorkspaceStore.jsx`
- `src/modules/details-workspace/hooks/useJobDirectState.js` -> `src/modules/details-workspace/hooks/useDetailsWorkspaceState.js`
- `src/modules/details-workspace/hooks/useJobDirectRealtimeSync.js` -> `src/modules/details-workspace/hooks/useDetailsWorkspaceRealtimeSync.js`
- `src/modules/job-records/exports/sdk.js` -> `src/modules/job-records/exports/api.js`
- `src/modules/details-workspace/exports/sdk.js` -> `src/modules/details-workspace/exports/api.js`

### Current Note

- Remaining naming cleanup is mostly inside symbol names and low-level infrastructure names. That will be handled during the later refactor items rather than this file-and-folder rename pass.

## Checklist

- [X] Create and maintain this checklist file as the single source of truth for the simplification work.
- [X] Define the target folder structure for pages, sections, hooks, api, and modals.
- [X] Add a guardrail so new or updated source files should stay under 500 lines.
- [X] Add naming rules so files and folders reflect current concepts and no legacy names like `job-direct` remain unless still truly used.
- [X] Inventory every source file over 500 lines and group them by refactor priority.
- [X] Inventory legacy file and folder names that no longer match the current app structure.
- [X] Rename legacy files and folders to current names across the app, including old `job-direct` naming.
- [X] Refactor the inquiry-details route shell and screen into thin shells plus focused sections and hooks. `InquiryDetailsScreen.jsx` is now `411` lines and the layout moved to `InquiryDetailsScreenLayout.jsx` at `312` lines.
- [X] Refactor `src/features/job-details/pages/JobDetailsPage.jsx` into a thin page shell plus focused sections and hooks. `JobDetailsPage.jsx` is now a thin route shell, with `JobDetailsScreen.jsx`, `JobDetailsHeaderBar.jsx`, and `useJobDetailsRouteContext.js` introduced for the split.
- [ ] Reduce `src/features/job-details/components/JobDetailsScreen.jsx` into a thin screen/layout plus focused hooks and sections. Current `JobDetailsScreen.jsx`: `4380` lines after extracting shared helpers, constants, `jobDetailsDataApi.js`, `JobWorkspaceTabPanel.jsx`, `JobQuotePaymentDetailsCard.jsx`, `JobDetailsWorkspaceSection.jsx`, `JobWorkspaceModals.jsx`, `JobDetailsModalStack.jsx`, and `JobDetailsFloatingWidgets.jsx`.
- [ ] Split `src/modules/job-records/api/jobDetailsApi.js` into smaller resource-based API files.
- [ ] Split `src/features/dashboard/api/dashboardApi.js` into smaller resource-based API files if still needed.
- [ ] Refactor `src/modules/details-workspace/components/sections/UploadsSection.jsx` into smaller components and hooks.
- [ ] Refactor `src/modules/details-workspace/components/modals/ContactDetailsModal.jsx` into smaller components and hooks.
- [ ] Refactor `src/modules/details-workspace/components/sections/job-information/AppointmentTabSection.jsx` into smaller components and hooks.
- [ ] Refactor `src/modules/details-workspace/components/sections/job-information/PropertyTabSection.jsx` into smaller components and hooks.
- [ ] Refactor `src/modules/details-workspace/components/sections/AddActivitiesSection.jsx` into smaller components and hooks.
- [ ] Refactor `src/modules/details-workspace/components/sections/InvoiceSection.jsx` and related invoice panels into smaller components and hooks.
- [ ] Remove dead code, duplicate logic, and unnecessary cross-feature abstractions created during growth.
- [ ] Run a strict app-wide unused-code audit for files, folders, imports, exports, helpers, components, hooks, and styles.
- [ ] Delete all unused code files and folders after verifying they are not referenced.
- [ ] Standardize a simple CRUD plus subscription pattern for the app and document it.
- [ ] Verify every source file in the app is 500 lines or less.
- [ ] Verify file and folder names are consistent, current, and understandable across the app.
- [ ] Run a final cleanup pass and update `AI_AGENT_HANDOFF.md` with the simplified structure.

## Update Rule

Whenever a checklist item is completed, mark it complete in this file in the same change set as the code change.

## Guardrails

- Run `npm run lint` for the standard guardrail set.
- Run `npm run lint:max-lines` to enforce the 500-line source-file rule.
- Existing oversized files are temporarily tracked in `scripts/max-lines-baseline.json`.
- Any new oversized source file fails the check.
- Any baseline oversized file that grows fails the check.
- Any baseline file that drops to 500 lines or less must be removed from the baseline in the same change set.
