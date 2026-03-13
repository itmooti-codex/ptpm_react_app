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

- Job details screen reduction complete: `src/features/job-details/components/JobDetailsScreen.jsx` (`445` lines), `JobDetailsBodySection.jsx` (`352` lines), plus focused hooks all under 500 lines
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

Current source files over 500 lines: 21

### Priority 0: Top-Level Control Files

These have the highest blast radius and create the most confusion because they mix rendering, state, side effects, data loading, subscriptions, and modal orchestration.

- `445` `src/features/job-details/components/JobDetailsScreen.jsx` (reduced from `4380` via hook extraction, then to `445` via body-section extraction) -- now compliant
- `100` `src/features/job-details/hooks/useJobScreenDerivedData.js` (reduced from `633` via split into `useJobAccountDerivedData.js` + `useJobStatusDerivedData.js`) -- now compliant
- `461` `src/features/job-details/hooks/useJobScreenActions.js` (reduced from `561` via split into `useJobModalActions.js`) -- now compliant
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
- `224` `src/modules/details-workspace/components/sections/AddMaterialsSection.jsx` (reduced from `1061` via split into `materialsUtils.js`, `useMaterialsCrud.js`, `MaterialsFormPanel.jsx`, `MaterialsTablePanel.jsx`) -- now compliant
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
- [X] Reduce `src/features/job-details/components/JobDetailsScreen.jsx` into a thin screen/layout plus focused hooks and sections. Reduced from `4380` to `765` lines by extracting 12 focused hooks, then to `445` lines by extracting `JobDetailsBodySection.jsx` (`352` lines).
- [X] Split `useJobScreenDerivedData.js` from `633` to `100` lines (thin combiner) by extracting `useJobAccountDerivedData.js` (`249` lines) and `useJobStatusDerivedData.js` (`416` lines).
- [X] Split `useJobScreenActions.js` from `561` to `461` lines by extracting `useJobModalActions.js` (`186` lines).
- [X] Split `src/modules/job-records/api/jobDetailsApi.js` into smaller resource-based API files. Replaced with `jobCoreApi.js`, `jobMutationsApi.js`, `jobMemosApi.js`, `jobNotesApi.js`, `jobLinkedJobApi.js`, `jobPropertyApi.js`, `jobTasksApi.js`, `jobUploadsApi.js`, `_helpers.js`, `_queryBuilders.js`, `_jobLinkSync.js` — all under 500 lines.
- [X] Split `src/features/dashboard/api/dashboardApi.js` into smaller resource-based API files. Split into `dashboardFilters.js` (300), `dashboardNormalizers.js` (219), `dashboardQueries.js` (364), `dashboardCounting.js` (329), `dashboardServiceProviders.js` (80), `dashboardMutations.js` (245) — `dashboardApi.js` is now a 33-line barrel.
- [X] Refactor `src/modules/details-workspace/components/sections/UploadsSection.jsx` into smaller components and hooks. Split into `uploadsConstants.js` (99), `uploadsUtils.js` (333), `uploadsIcons.jsx` (102), `useUploadsPending.js` (490), `useUploadsActions.js` (265), `useUploadsSection.js` (33), `UploadsExistingCard.jsx` (366), `UploadsSection.jsx` (383) — all under 500 lines.
- [X] Refactor `src/modules/details-workspace/components/modals/ContactDetailsModal.jsx` into smaller components and hooks. Split into `contactDetailsSchema.js` (116), `contactDetailsUtils.js` (167), `contactDetailsApi.js` (123), `AccordionSection.jsx` (22), `ContactIndividualFields.jsx` (210), `ContactEntityFields.jsx` (232), `useContactDetailsLookups.js` (500), `ContactDetailsModal.jsx` (463) — all under 500 lines.
- [X] Refactor `src/modules/details-workspace/components/sections/job-information/AppointmentTabSection.jsx` into smaller components and hooks. Split into `appointmentTabUtils.jsx` (294), `useAppointmentForm.js` (294), `useAppointmentLookups.js` (360), `useAppointmentCrud.js` (284), `useAppointmentOperations.js` (262), `AppointmentTabSection.jsx` (467) — all under 500 lines.
- [X] Refactor `src/modules/details-workspace/components/sections/job-information/PropertyTabSection.jsx` into smaller components and hooks. Split into `propertyTabUtils.jsx` (24), `usePropertyAffiliations.js` (300), `usePropertyUploads.js` (348), `PropertyDetailsPanel.jsx` (316), `PropertyContactsPanel.jsx` (180), `PropertyUploadsSection.jsx` (261), `PropertyTabSection.jsx` (267) — all under 500 lines.
- [X] Refactor `src/modules/details-workspace/components/sections/AddActivitiesSection.jsx` into smaller components and hooks. Split into `activitiesUtils.js` (225), `useActivitiesServices.js` (150), `useActivitiesCrud.js` (326), `ActivitiesFormPanel.jsx` (172), `ActivitiesTablePanel.jsx` (278), `AddActivitiesSection.jsx` (332) — all under 500 lines.
- [X] Refactor `src/modules/details-workspace/components/sections/InvoiceSection.jsx` and related invoice panels into smaller components and hooks. Split into `invoice/invoiceUtils.js` (390), `invoice/useInvoiceForm.js` (337), `invoice/useInvoiceCrud.js` (348), `invoice/ClientInvoicePanel.jsx` (390), `invoice/InvoicePanels.jsx` (233), `InvoiceSection.jsx` (243) — all under 500 lines.
- [X] Refactor `src/modules/details-workspace/components/modals/TasksModal.jsx` from `974` into smaller components and hooks. Split into `tasksModalUtils.js` (175), `AssigneeSearchField.jsx` (96), `useTasksCrud.js` (184), `useTasksForm.js` (204), `TasksFormPanel.jsx` (92), `TasksTablePanel.jsx` (168), `TasksModal.jsx` (270) — all under 500 lines.
- [X] Refactor `src/modules/details-workspace/components/modals/PropertyAffiliationModal.jsx` from `730` into smaller components and hooks. Split into `propertyAffiliationUtils.js` (135), `SearchLookupInput.jsx` (177), `usePropertyAffiliationForm.js` (279), `PropertyAffiliationModal.jsx` (193) — all under 500 lines.
- [X] Refactor `src/modules/details-workspace/components/modals/AddPropertyModal.jsx` from `626` into smaller files. Split into `addPropertySchema.js` (91), `addPropertyUtils.js` (116), `AddPropertyModal.jsx` (417) — all under 500 lines.
- [X] Refactor `src/modules/details-workspace/components/sections/JobInformationSection.jsx` from `577` into smaller files. Split into `usePropertyActions.js` (190), `useJobInformationState.js` (391), `JobInformationSection.jsx` (150) — all under 500 lines.
- [X] Refactor `src/shared/components/RecentActivitiesDock.jsx` from `876` into smaller files. Split into `recentActivitiesConstants.js` (13), `recentActivitiesUtils.js` (331), `recentActivitiesApi.js` (243), `useRecentActivities.js` (240), `RecentActivitiesDockItem.jsx` (39), `RecentActivitiesDock.jsx` (58) — all under 500 lines.
- [X] Refactor `src/shared/announcements/announcementEmitter.js` from `792` into smaller files. Split into `announcementEmitterConfig.js` (206), `announcementEmitterHelpers.js` (197), `announcementRecentActivity.js` (174), `announcementEmitter.js` (226) — all under 500 lines.
- [X] Refactor `src/shared/providers/AnnouncementsProvider.jsx` from `637` into smaller files. Split into `announcementsProviderHelpers.js` (289), `AnnouncementsProvider.jsx` (362) — all under 500 lines.
- [X] Refactor `src/shared/components/ui/MemoChatPanel.jsx` from `584` into smaller components and utilities. Split into `MemoChatMemoList.jsx` (278), `MemoChatFooter.jsx` (92), `MemoChatEmptyState.jsx` (71), `memoChatUtils.js` (29), `MemoChatPanel.jsx` (204) — all under 500 lines.
- [X] Refactor `src/modules/details-workspace/components/layout/DetailsWorkspaceLayout.jsx` from `501` into smaller files. Extracted `useJobDirectOverviewSave.js` (334), `DetailsWorkspaceLayout.jsx` (196) — all under 500 lines.
- [X] Refactor `src/features/account/pages/ProfilePage.jsx` from `520` into smaller files. Extracted `ProfileFormFields.jsx` (215), `ProfilePage.jsx` (313) — all under 500 lines.
- [X] Refactor `src/features/dashboard/pages/DashboardPage.jsx` from `821` into smaller files. Split into `useDashboardPageState.js` (432), `useDashboardRecordActions.js` (158), `useDashboardExportActions.js` (79), `DashboardFullPageStates.jsx` (44), `dashboardExport.js` (127), `DashboardPage.jsx` (223) — all under 500 lines.
- [X] Remove dead code, duplicate logic, and unnecessary cross-feature abstractions created during growth. Removed 26 duplicate `toText()` definitions (all now import from `@shared/utils/formatters.js`). Fixed `lint:boundaries` script to accept `exports/` paths (was still expecting old `public/` folder name). Fixed 15 deep-module import violations (runtime.js/transport.js → `exports/api.js`). Fixed 4 cross-feature violations by moving `ContactLogsPanel`, `JobMemosPreviewPanel`, `JobNotesPanel`, and `useRelatedRecordsData` to `details-workspace` module and exporting them. `npm run lint` now passes cleanly.
- [X] Run a strict app-wide unused-code audit for files, folders, imports, exports, helpers, components, hooks, and styles. No orphaned files found. All source files are imported and active.
- [X] Delete all unused code files and folders after verifying they are not referenced. No unused files found to delete.
- [X] Standardize a simple CRUD plus subscription pattern for the app and document it. Documented in `CRUD_PATTERNS.md` at project root: standard fetch (guard → query → fetchDirectWithTimeout → normalize → catch/return empty), mutation (validate → normalize → execute → isCancelling check → statusFailure check → throw), subscribe (guard → subscribeToQueryStream → return cleanup), and hook patterns. Removed duplicate local `toPromiseLike` from `jobDetailsDataApi.js` — now imports canonical version from `@modules/details-workspace/exports/api.js`.
- [X] Verify every source file in the app is 500 lines or less. `npm run lint:max-lines` passes with 0 baseline exceptions.
- [X] Verify file and folder names are consistent, current, and understandable across the app. Renamed all legacy `JobDirect*` exported symbols in `useDetailsWorkspaceStore.jsx` to `DetailsWorkspace*` (`DetailsWorkspaceStoreProvider`, `useDetailsWorkspaceStore`, `useDetailsWorkspaceStoreActions`, `useDetailsWorkspaceSelector`) and updated all 18 callers. Renamed `useJobDirectOverviewSave.js` → `useWorkspaceOverviewSave.js`. No remaining `job-workspace` or `job-direct` naming in source files.
- [X] Run a final cleanup pass and update `AI_AGENT_HANDOFF.md` with the simplified structure. Rewrote `AI_AGENT_HANDOFF.md` to reflect the current codebase: correct module paths (`exports/` not `public/`), correct store hook names, current dashboard API structure, removed all stale known-issues (boundary lint now passes clean), updated "Files to Read First" table, added CRUD_PATTERNS.md reference.

## Update Rule

Whenever a checklist item is completed, mark it complete in this file in the same change set as the code change.

## Guardrails

- Run `npm run lint` for the standard guardrail set.
- Run `npm run lint:max-lines` to enforce the 500-line source-file rule.
- Existing oversized files are temporarily tracked in `scripts/max-lines-baseline.json`.
- Any new oversized source file fails the check.
- Any baseline oversized file that grows fails the check.
- Any baseline file that drops to 500 lines or less must be removed from the baseline in the same change set.
