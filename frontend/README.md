# Kaagaz2Code — Frontend (SIH26018)

## What changed in this pass

The UI/visual design is untouched. What was wired up is the **data layer**
so this prototype can talk to the real FastAPI backend (Phase 1–5) instead
of only ever showing mock data:

- `src/contexts/AuthContext.tsx` — new. Handles login, logout, session
  restore, and role checks (`citizen` / `officer` / `reviewer` / `admin`).
- `src/api/services.ts` — added `login`, `refreshAccessToken`,
  `getCurrentUser`, `uploadDocument`; `request()` now attaches the
  `Authorization: Bearer <token>` header automatically and retries once
  after a silent token refresh on `401`.
- `src/api/types.ts` — `UserRole` now includes `reviewer` (it was missing);
  added `LoginRequest`/`LoginResponse`/`AuthTokens` and upload/lookup types.
- `src/App.tsx` — wraps routes in `AuthProvider`; `/upload`, `/review`,
  `/queue`, `/records/:id`, `/discrepancy/:id`, `/map` require
  `officer` / `reviewer` / `admin`; `/admin` requires `admin`. Unauthenticated
  visitors are redirected to `/login`.
- `src/components/shared/OfficerLayout.tsx` — nav items are filtered by the
  signed-in user's role; the profile button now shows the real user and
  signs out on click.
- `src/pages/LoginPage.tsx` — submits to the real `/auth/login` endpoint
  (or mock login) via `AuthContext`, then routes by the role the backend
  returns.
- `src/pages/LookupPage.tsx` — calls `getLookupResults()` with the search
  type/query instead of always returning the same mock array.
- `src/pages/UploadPage.tsx` — `handleStartProcessing` now calls
  `uploadDocument()` (multipart upload) and passes the resulting record id
  to the Review page instead of just running a fake timer.
- `src/pages/ReviewPage.tsx` — loads the actual record and its extracted
  fields (`getRecordById` / `getExtractedFields`), saves edited field
  values (`updateExtractedField`) and the reviewer's decision
  (`submitReviewDecision`) instead of operating on a hardcoded mock record.

## Running this prototype

By default `VITE_USE_MOCKS=true` (see `.env`), so `npm run dev` runs
standalone with bundled mock data — no backend required, for demo purposes.

To connect the real FastAPI backend:

1. Set `VITE_API_BASE_URL` in `.env` to your backend's `/api/v1` URL.
2. Set `VITE_USE_MOCKS=false`.
3. Run the backend, then `npm run dev`.

Still using mock data for now: Admin Dashboard, Map, Discrepancy
Comparison, and Multilingual pages (per the current demo scope).

If `npm run build` / `npm run dev` complain about missing native
bindings, delete `node_modules` and `package-lock.json` and run
`npm install` fresh on your own machine — the bundled `node_modules`
in this zip was captured on a different OS/architecture.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
