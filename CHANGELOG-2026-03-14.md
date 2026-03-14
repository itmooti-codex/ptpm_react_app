# Changes — 2026-03-14

Author: Andrew Wadsworth (via Claude Code)

---

## Summary

Three changes shipped today:

1. **JWT Authentication with Login Page** — the app now has its own login system connected to the `ptpm_admin` MySQL database
2. **Team/User Management** — admin UI to view and manage team members (admin_users), with VitalStats ServiceProvider linkage

---

## 1) Authentication System

### What changed

The app previously relied on environment variables (`VITE_APP_USER_ID`, `VITE_DEMO_USER_IDS`) or the `DemoUserGate` component to resolve the current user. It now has a proper JWT login flow.

### How it works

1. User visits the app and sees a **Sign In** page
2. Credentials are verified against the `admin_users` table in the `ptpm_admin` MySQL database via the Express backend (`POST /api/login`)
3. On success, the API returns a JWT token and user object including `serviceProviderId` and `contactId`
4. The token is stored in `localStorage` and auto-verified on page load (`GET /api/verify`)
5. `contactId` is injected into `window.__PTPM_CURRENT_USER_ID` so all existing VitalStats queries (CurrentUserProfileProvider, AnnouncementsProvider, etc.) work without changes
6. Logout clears the token and reloads the page

### New files

```
src/features/auth/api/authApi.js          — login(), verifyToken(), logout(), token storage
src/features/auth/pages/LoginPage.jsx     — login form UI
src/shared/providers/AuthProvider.jsx     — JWT state management context provider
src/shared/hooks/useAuth.js              — useAuth() hook
src/app/AuthGate.jsx                     — renders LoginPage or app based on auth state
```

### Modified files

| File | Change |
|------|--------|
| `src/main.jsx` | Replaced `DemoUserGate` with `AuthProvider` + `AuthGate` |
| `src/shared/layout/GlobalTopHeader.jsx` | Logout now calls `auth.logout()` instead of navigating |
| `vite.config.js` | Added `/api` proxy to `localhost:4080` for local dev |

### Database changes (on deploy server)

Two columns added to `admin_users` table:

```sql
ALTER TABLE admin_users
  ADD COLUMN service_provider_id INT NULL,
  ADD COLUMN contact_id INT NULL;
```

- `service_provider_id` → links to VitalStats `PeterpmServiceProvider.id` (type=Admin)
- `contact_id` → links to VitalStats `PeterpmContact.id` (used as the app's user ID for all VitalStats queries)

### Express API changes (on deploy server: `/srv/projects/ptpm-admin/server/src/routes/auth.ts`)

All auth endpoints now include `serviceProviderId` and `contactId` in responses:
- `POST /api/login` — returns `user.serviceProviderId` and `user.contactId`
- `GET /api/verify` — returns `user.serviceProviderId` and `user.contactId`
- `GET /api/users` — returns `serviceProviderId` and `contactId` per user
- `POST /api/users` — accepts `serviceProviderId` and `contactId` on create
- `PATCH /api/users/:id` — accepts `serviceProviderId` and `contactId` on update

### Current users in database

| id | email | name | role | service_provider_id | contact_id |
|----|-------|------|------|---------------------|------------|
| 1 | info@possumman.com.au | Susan Vernon | super_admin | 33 | 374 |

### Login credentials

- Email: `info@possumman.com.au`
- Password: `zzzRQWYDQ2Dw@` (from seed — should be changed)

### Local dev setup

For the login to work locally, you need an SSH tunnel to the deploy server:

```bash
ssh -N -L 4080:localhost:3090 admin@15.204.34.114
```

This forwards local port 4080 to the nginx container (port 3090), which proxies `/api/*` to the Express backend. The Vite proxy in `vite.config.js` then forwards `/api` requests from the browser to `localhost:4080`.

---

## 2) Team/User Management

### What changed

New `/admin/users` section for managing team members. Accessible from the profile dropdown menu ("Team" link) or directly at `/admin/users`.

### Routes added

| Route | Component | Purpose |
|-------|-----------|---------|
| `/admin/users` | `UserManagementPage` | Paginated, searchable list of all VitalStats users |
| `/admin/users/new` | `UserDetailPage` | Create new user form |
| `/admin/users/:userId` | `UserDetailPage` | View/edit user with linked service provider card |

### New files

```
src/features/user-management/
  api/
    userManagementApi.js            — SDK/GraphQL queries for users, roles, SPs
    userManagementMutations.js      — Create/update user mutations
    userManagementNormalizers.js     — Normalize VitalStats responses
  components/
    UserManagementHeader.jsx        — Search bar + Add User button
    UserManagementTable.jsx         — Paginated user list table
    UserDetailPanel.jsx             — Account details sidebar card
    UserFormFields.jsx              — Form fields for personal, business, account info
    RoleSelector.jsx                — Role dropdown
    ServiceProviderCard.jsx         — Linked service provider info card
    columns/
      userColumns.jsx               — Table column definitions
  constants/
    userManagementConstants.js      — Language enums, status/workload colors
  hooks/
    useUserManagementData.js        — List with pagination, search, debounce
    useUserDetail.js                — Single user fetch + update
    useRoles.js                     — Fetch all PeterpmRole records
    useLinkedServiceProvider.js     — Fetch SP by owner_id
  pages/
    UserManagementPage.jsx          — List page
    UserDetailPage.jsx              — Detail/edit/create page
```

### Modified files

| File | Change |
|------|--------|
| `src/app/App.jsx` | Added 3 routes + lazy imports for user management pages |
| `src/shared/layout/GlobalTopHeader.jsx` | Added "Team" link to profile dropdown menu |

### Data layer

Queries the existing VitalStats tables — no new database tables:
- `PeterpmUser` (29 fields) — staff/admin user records
- `PeterpmRole` (3 fields) — role definitions
- `PeterpmServiceProvider` (88 fields) — linked via `owner_id` FK to User

---

## AI Agent Knowledge Base Updates

If you maintain an AI agent knowledge base for this project, update the following:

1. **Authentication:** The app now uses JWT auth via Express backend, not env vars. The `DemoUserGate` is no longer in the render tree — `AuthGate` replaces it.

2. **Provider stack** (in `main.jsx`):
   ```
   AuthProvider > AuthGate > BrowserRouter > ToastProvider > CurrentUserProfileProvider > AnnouncementsProvider > App
   ```

3. **New routes:** `/admin/users`, `/admin/users/new`, `/admin/users/:userId`

4. **User ID resolution:** After login, `contactId` from the JWT response is injected into `window.__PTPM_CURRENT_USER_ID`. The existing `userConfig.js` → `getCurrentUserId()` chain picks it up automatically.

5. **Logout:** Clears localStorage token + user, resets window globals, reloads page.

6. **API proxy:** Vite dev server proxies `/api` to `localhost:4080`. In production (Docker), nginx handles the proxy.

7. **Express API auth.ts:** Now includes `service_provider_id` and `contact_id` in all user-related endpoints.

---

## 3) Team Management Rework — MySQL + VitalStats SP Linking

### What changed (second commit)

The Team Management page was originally querying VitalStats `PeterpmUser` (Ontraport system users). It has been reworked to manage `admin_users` in MySQL via the Express API, with a ServiceProvider lookup for linking users to their VitalStats identity.

### Data flow

- **User list and CRUD** → Express API (`GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `GET /api/users/:id`) → MySQL `admin_users`
- **ServiceProvider lookup** → VitalStats GraphQL (for the linking dropdown)
- **Linked SP details** → VitalStats SDK query by `service_provider_id`

### New Express endpoint

`GET /api/users/:id` — returns a single admin_user by ID (added to deploy server `auth.ts`)

### Role-based permissions

| Feature | Team Member | Admin | Super Admin |
|---------|-------------|-------|-------------|
| Edit name/display name | Yes | Yes | Yes |
| Change password | Current + new required | Current + new required | New only |
| Edit email | No | Yes | Yes |
| Role dropdown | No | No | Yes |
| Active toggle | No | No | Yes |
| Link/unlink service provider | No | No | Yes |
| SP card details | No | No | Yes |
| User ID in detail panel | No | No | Yes |
| SP/Contact IDs in detail panel | No | No | Yes |

### SP auto-fill

When a super admin selects a service provider from the lookup, the form auto-fills first name, last name, display name, and email from the SP's contact information.

### Files changed

**Rewritten:**
- `api/userManagementApi.js` — Express fetch + VitalStats SP lookup (was all VitalStats)
- `api/userManagementMutations.js` — Express create/update (was VitalStats SDK mutations)
- `api/userManagementNormalizers.js` — simplified to SP normalizer only

**New:**
- `components/ServiceProviderLookup.jsx` — searchable dropdown of all VitalStats SPs
- `hooks/useServiceProviderOptions.js` — fetches SP list from VitalStats

**Deleted:**
- `components/RoleSelector.jsx` — no longer needed (Express uses string roles)
- `hooks/useRoles.js` — no longer needed

**Modified:**
- All remaining hooks — removed VitalStats plugin dependency
- `UserFormFields.jsx` — role-based field visibility, current password for non-super-admins
- `UserDetailPanel.jsx` — role-based field visibility (IDs hidden from non-super-admins)
- `UserDetailPage.jsx` — SP lookup + auto-fill, role-based sections
- `UserManagementPage.jsx` — simplified (no VitalStats plugin needed)
- `columns/userColumns.jsx` — updated for Express response format
- `constants/userManagementConstants.js` — added ADMIN_ROLE_OPTIONS

### AI Agent Knowledge Base Updates

- Team management now uses Express API, NOT VitalStats `PeterpmUser`
- The `admin_users` MySQL table is the source of truth for app login users
- VitalStats is only used for ServiceProvider lookup/linking and Contact resolution
- Role-based UI: super_admin sees everything, admin sees account settings, team_member sees profile only
