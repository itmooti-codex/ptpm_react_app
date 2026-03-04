# Folder Structure Plan (Safe Migration)

## Goals
- Stop cross-feature imports (`inquiry-direct` / `job-details` importing from `job-direct`).
- Move reused business modules out of feature folders.
- Keep runtime stable during migration (no big-bang move).
- Make future refactors simpler by clear boundaries.

## Boundary Rules
- `src/features/*`: route/page-specific composition only.
- `src/modules/*`: reusable business modules (domain UI, hooks, state, SDK).
- `src/shared/*`: generic UI/utilities with no business-domain ownership.
- `src/platform/*`: infrastructure and external integration plumbing (VitalStats SDK/plugin bootstrap).
- Rule: **features do not import from other features**.

## Proposed Target Structure

```text
src/
  app/
  features/
    account/
    dashboard/
    inquiry-direct/
    job-details/
    job-direct/
  modules/
    job-workspace/
      components/
        icons/
        modals/
        primitives/
        sections/
          invoice/
          job-information/
      constants/
      hooks/
      sdk/
        core/
        domains/
        utils/
      state/
      utils/
  platform/
    vitalstats/
      bootstrap.js
      config.js
      useVitalStatsPlugin.js
  shared/
    announcements/
    components/ui/
    hooks/
    layout/
    providers/
    utils/
```

## What Moves (High-confidence shared set)

From `src/features/job-direct/*` to `src/modules/job-workspace/*`:
- `components/icons/*`
- `components/modals/*`
- `components/primitives/*`
- `components/sections/*`
- `constants/*`
- `hooks/useJobDirectStore.jsx`
- `hooks/useContactEntityLookupData.js`
- `hooks/usePropertyLookupData.js`
- `hooks/useServiceProviderLookupData.js`
- `state/*`
- `utils/*`
- `sdk/core/*`
- `sdk/domains/*`
- `sdk/utils/*`

From `src/features/job-direct/sdk/*` to `src/platform/vitalstats/*`:
- `sdk/vitalStatsBootstrap.js` -> `platform/vitalstats/bootstrap.js`
- `sdk/vitalStatsConfig.js` -> `platform/vitalstats/config.js`
- `hooks/useVitalStatsPlugin.js` -> `platform/vitalstats/useVitalStatsPlugin.js`

Remain in `src/features/job-direct/*` (page-specific):
- `pages/JobDirectPage.jsx`
- route-level composition wrappers specific to that page
- job-direct-only style/docs files

## Migration Strategy (No-break)

1. Add path aliases in `vite.config.js` (and `jsconfig.json`) for:
   - `@features`, `@modules`, `@platform`, `@shared`.
2. Create target folders.
3. Move files in small batches.
4. At old paths, keep temporary compatibility re-export files.
5. Update imports gradually to new paths.
6. Build after every batch.
7. Remove compatibility files only after all imports are migrated.

## Batch Order

1. `platform/vitalstats` (bootstrap/config/hook)  
2. `modules/job-workspace/sdk` + `modules/job-workspace/state`  
3. `modules/job-workspace/components/primitives|icons|constants`  
4. `modules/job-workspace/components/modals`  
5. `modules/job-workspace/components/sections` + related hooks/utils  
6. cleanup compatibility re-exports

## Validation Gates
- `npm run build` after each batch.
- Search check after each batch:
  - no imports like `from "../../job-direct/...` outside `features/job-direct`.
- Smoke-check only affected routes after each batch.

