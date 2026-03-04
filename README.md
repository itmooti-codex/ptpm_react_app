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
  shared/
    components/ui/
    layout/
    lib/
  features/
    job-direct/
      components/
        JobDirectLayout.jsx
        JobDirectHeader.jsx
        JobDirectSidebar.jsx
        JobDirectContent.jsx
        sections/
        modals/
      hooks/
        useJobUid.js
        useJobDirectData.js
        useJobDirectState.js
      pages/
        JobDirectPage.jsx
      sdk/
        core/
          runtime.js
      styles/
        jobDirectOverrides.css
      docs/
        legacy-runtime-map.md
  main.jsx
  index.css
```

## Job UID behavior

The app reads:

- `jobuid` from `window.location.search`

Example:

- `http://localhost:5173/?jobuid=abc123`

This is wired in `src/features/job-direct/hooks/useJobUid.js`.

## SDK integration status

`src/features/job-direct/sdk/core/runtime.js` contains a stable function contract:

- `fetchJobDirectDataByUid({ jobUid, plugin })`

This is the active SDK entry used by feature modules.

## Legacy trace reference

A runtime trace of legacy HTML/JS scripts, sections, tabs, and modal creators is documented in:

- `src/features/job-direct/docs/legacy-runtime-map.md`
