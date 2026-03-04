# Dashboard QA Checklist

Use this checklist for manual regression testing of the Dashboard page.

## Pre-Checks

- [ ] `npm install` completed successfully.
- [ ] Environment values are configured (`.env.local` based on `.env.example`).
- [ ] App starts with `npm run dev` without startup errors.
- [ ] Dashboard has test data across tabs (`inquiry`, `quote`, `jobs`, `payment`, `active-jobs`, `urgent-calls`, `open-tasks`).
- [ ] At least one tab has filtered results spanning multiple pages.
- [ ] For pagination-cap verification: at least one filtered scenario has more than 1000 matching records.

## Smoke Test

- [ ] Open `/` and confirm Dashboard renders.
- [ ] Confirm top header, tabs, filter sidebar, table, and pagination controls are visible.
- [ ] Confirm no blocking UI errors appear on initial load.

## Tab Navigation

- [ ] Switch through every tab in sequence.
- [ ] Confirm each tab loads rows (or valid empty state) and does not crash.
- [ ] Confirm tab count badges render and update when tab changes.

## Filter + Pagination (Critical)

- [ ] On a tab with enough data, apply filters that still return multiple pages.
- [ ] Confirm current page resets to page 1 after applying filters.
- [ ] Move to page 2 and page 3.
- [ ] Confirm rows differ between pages (no repeated page-1-only data).
- [ ] Confirm `totalCount` and `totalPages` reflect full filtered result size.
- [ ] For large dataset case (>1000 matches), confirm total count exceeds 1000 and pages remain navigable past the old cap.
- [ ] Remove all filters and confirm table and totals return to unfiltered behavior.

## Sorting

- [ ] Toggle sort order (`desc`/`asc`) on current tab.
- [ ] Confirm row ordering changes accordingly.
- [ ] Confirm pagination remains consistent after sort change.

## Calendar Filter Behavior

- [ ] Select a date range in calendar.
- [ ] Confirm `dateFrom`/`dateTo` chips appear and rows are filtered.
- [ ] Clear calendar range and confirm rows reset.

## Row-Level Actions

- [ ] Open a row using "view" action and confirm navigation to `/details/:uid`.
- [ ] Open task modal from a row and confirm context is correct (`deal` on inquiry tab, `job` on other tabs).
- [ ] Execute single-record cancel and confirm row status updates to `Cancelled`.

## Batch Actions

- [ ] Enable batch mode.
- [ ] Select multiple rows across current page.
- [ ] Run batch cancel and confirm success message appears.
- [ ] Confirm count badge decreases and batch selection clears.

## Export + Print

- [ ] Print current table and confirm popup opens with expected columns.
- [ ] Export current table CSV and confirm file downloads with non-empty rows.
- [ ] Export service providers CSV and confirm file downloads with expected columns.

## Loading/Error States

- [ ] Simulate slow network and confirm loading states appear (no frozen UI).
- [ ] Simulate API error and confirm non-crashing error state renders.
- [ ] Refresh page and confirm cached state does not break pagination or filter behavior.

## Console + Stability

- [ ] Perform full pass without unhandled promise errors in browser console.
- [ ] Confirm no React runtime errors/warnings related to dashboard flow.

## Sign-Off

- Tester:
- Date:
- Environment:
- Build/commit:
- Result: Pass / Fail
- Notes:
