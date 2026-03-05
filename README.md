# PTPM React App (Phase 1)

This React app is the new base for the PTPM project. In this phase, the app focuses on the **Job Direct** page UI and visual parity.

## Run

```bash
cd ptpm_react_app
npm install
cp .env.example .env.local
npm run dev
```

Required environment variables are listed in `.env.example`.

## QA

- Dashboard regression checklist: `docs/dashboard-qa-checklist.md`

## Current scope

- React + Vite + Tailwind setup
- Global design tokens from `design.md` configured as CSS variables and Tailwind theme colors
- Inter configured as the base font family
- Main page renders the migrated Job Direct layout via React components (no external HTML template rendering)
- URL parsing is ready for `?jobuid=someuid`

## Folder structure

```text
src/
  app/
    App.jsx
  platform/
    vitalstats/
      bootstrap.js
      config.js
      useVitalStatsPlugin.js
  modules/
    job-workspace/
      public/
        components.js
        hooks.js
        constants.js
        sdk.js
      components/
      hooks/
      constants/
      sdk/
      state/
      utils/
    job-records/
      public/
        sdk.js
      sdk/
        jobDetailsSdk.js
  shared/
    announcements/
    components/ui/
    constants/
    hooks/
    layout/
    lib/
    sdk/
    utils/
  features/
    account/
    dashboard/
    inquiry-direct/
    job-details/
    job-direct/
      pages/JobDirectPage.jsx
      hooks/useJobDirectBootstrap.js
      hooks/useJobUid.js
      styles/jobDirectOverrides.css
      docs/legacy-runtime-map.md
  main.jsx
  index.css
```

## Job UID behavior

The app reads `jobuid` from:

- route param (`/job-direct/:jobuid`)
- query string fallback (`?jobuid=...`)

Example:

- `http://localhost:5173/job-direct/abc123`
- `http://localhost:5173/job-direct?jobuid=abc123`

This is wired in `src/features/job-direct/hooks/useJobUid.js`.

## Module import rules

- Features should import modules only through module public entrypoints:
  - `@modules/job-workspace/public/components.js`
  - `@modules/job-workspace/public/hooks.js`
  - `@modules/job-workspace/public/constants.js`
  - `@modules/job-workspace/public/sdk.js`
  - `@modules/job-records/public/sdk.js`
- Deep imports into module internals are intentionally blocked by boundary lint.

Run:

```bash
npm run lint:boundaries
```

## Legacy trace reference

A runtime trace of legacy HTML/JS scripts, sections, tabs, and modal creators is documented in:

- `src/features/job-direct/docs/legacy-runtime-map.md`
