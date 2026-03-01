# Legacy Job Direct Runtime Map

This map traces what the old `pages/new-direct-job.html` + `js/views/job-detail.js` runtime actually does, so React migration can stay behavior-complete.

## Script includes from legacy HTML

- `https://cdn.tailwindcss.com`
- `https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js`
- `https://cdn.jsdelivr.net/npm/flatpickr`
- `../js/app.js` (module bootstrap -> routes `data-page="new-direct-job"` to `initDirectJob()`)
- Lazy Google Places script with callback `initAutocomplete`

## Page navigation/data attributes

- Header actions: `data-nav-action="cancel|reset|save-draft|back|next"`
- Sidebar section targets:
  - `job-information`
  - `add-activities`
  - `add-materials`
  - `uploads`
  - `invoice`
- Job info tabs:
  - `data-tab="overview"`
  - `data-tab="appointments"`

## Legacy sections

Static in HTML:
- `data-section="job-information"`
- `data-section="address"`
- `data-section="postal-address"`
- `data-section="replaceable-section"` (mount point)

Created dynamically by `JobDetailView`:
- `data-section="add-activities"`
- `data-section="add-materials"`
- `data-section="uploads"`
- `data-section="invoice"`

## Legacy modal inventory

Present in static HTML:
- Contact details modal (`modal-name="contact-detail-modal"`, `id="addressDetailsModalBox"`)
- Add property modal (`id="jobAddPropertyModal"`)

Created dynamically in `js/views/job-detail.js`:
- `createDealInformationModal()`
- `CreateQuoteOnBehalfOfServicemanModal()`
- `EditNotes()`
- `createViewJobDocumentsModal()`
- `createActivityListModal()`
- `createWildlifeReportModal()`
- `createTasksModal()`
- status/confirm/helper modals via shared helper methods

## Migration status in React

Implemented in React component tree:
- App shell/header/sidebar/section navigation
- Job info tabs and section switching
- React forms for all major sections (job info, activities, materials, uploads, invoice)
- Contact details + add property modals
- Placeholder legacy runtime modal set (deal info / quote docs / activity list / wildlife / tasks)

Pending for behavior parity phase:
- SDK-backed data population and save/update flows
- Flatpickr bindings + Google places autocomplete
- Dynamic tables and row operations
- Full action handlers for legacy modal workflows
