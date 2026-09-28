# Kaagaz2Code (SIH26018) — Deploy-Readiness Plan

Based on analysis of `Kaagaz2Code-SIH2601A-MongoDB-FastAPI.zip` (git baseline `eb1eae5`, branch `main`, plus uncommitted edits).
Written 2026-09-28. Nothing here has been implemented yet — this is the plan we execute task by task.

---

## 0. Decisions I need from you before Task 1

The zip contradicts earlier project context in three places. Each changes the plan, so please confirm.

| # | Conflict | What the zip says | What earlier context says | My default if you don't answer |
|---|---|---|---|---|
| D1 | **Database / backend stack** | FastAPI + **MongoDB (Motor) + GridFS**. `IMPLEMENTATION.md` explicitly removes PostgreSQL, SQLAlchemy, Alembic, Node/Express. | Earlier brief: FastAPI + PostgreSQL + SQLAlchemy + Alembic. Earlier chats: Node/Express + Supabase. | **Keep MongoDB + FastAPI** (it is the newest code and ~3,200 lines already exist). The adapter pattern (Section 5) keeps a later Postgres move possible. |
| D2 | **Roles** | 4 roles: `citizen`, `officer`, `reviewer`, `admin`. Upload = officer/admin; review/approve = reviewer/admin. | Later decision: 3 roles — officer absorbs reviewer. | **Keep 4 roles in code**; the frontend can present officer+reviewer as one "Officer" experience. Merging roles is a small change if you want it. |
| D3 | **LLM provider** | `.env` uses **Groq** (`openai/gpt-oss-20b`). Extractor supports `gemini`, `openai`, `groq`, `mock`. | Earlier notes: Grok (xAI). | **Groq via the existing adapter** (no code change). xAI Grok would be one more adapter branch. |

Also confirm: **deployment target**. Plan assumes **Vercel (frontend) + a Docker host for the two Python services + MongoDB Atlas M0**. The AI service needs roughly 1.2 GB RAM at runtime (per its README), so check the RAM of whatever host tier you pick before committing.

---

## 1. What the zip actually contains

```
Kaagaz2Code-SIH2601A-MongoDB-FastAPI/
├── frontend/            React 19 + TS + Vite 8 + Tailwind 4 + react-router 7 + Leaflet
├── fastapi_backend/     FastAPI + Motor + GridFS + PyJWT + slowapi   (~3,250 lines)
├── ai-service/          FastAPI + OpenCV + PaddleOCR (hi+en) + LLM adapter
├── docker-compose.yml   mongodb + backend + ai-service
├── IMPLEMENTATION.md, README.md, MIGRATION_FROM_POSTGRES.md
├── BACKEND_VALIDATION.md, BACKEND_VALIDATION_PR.md   (describe code that is NOT in the tree — see F1)
└── fake.pdf, malicious.pdf, oversized.pdf, test.txt  (loose test artifacts at repo root)
```

Verified during analysis:
- Backend and AI service Python **compile cleanly**.
- Frontend **`tsc -b` passes** (exit 0).
- `.env` files are **not tracked** by git (good), but they are inside the zip.
- `frontend/.env` has `VITE_USE_MOCKS=true` — the frontend is currently running on mock data.

Not verified (no live services here): MongoDB/Atlas connectivity, Google OAuth, real OCR/LLM output, Docker builds.

---

## 2. Findings (gap analysis)

Severity: 🔴 blocks deployment or breaks the core promise · 🟠 must fix before demo/pilot · 🟡 should fix.

### Missing or broken versus the approved flowchart

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| F1 | 🔴 | **The validation/conflict/duplicate work is documented but absent.** `BACKEND_VALIDATION.md` describes `validation_service.py`, `conflict_service.py`, `normalization_service.py`, `validation_workflow.py`, 52 passing tests — none of these files exist. `app/services/` contains only `audit_service.py`; there is no `fastapi_backend/tests/`; git has only `main` and `frontend-redesign` (no `backend-validation` branch). | file listing, `git branch -a` |
| F2 | 🔴 | **No validation, no existing-record check, no discrepancy detection in the pipeline.** After OCR, `queue.py` only checks whether the AI said `verified`/`approved`; otherwise the document goes to `needs_review`. Nothing compares against existing records. | `queue.py` lines ~245–275 |
| F3 | 🔴 | **No versioned verified record.** `land_records` collection is declared and indexed but never written. "Verified" is just `documents.status`; corrections overwrite `processing_jobs.result` in place. This is exactly the silent-overwrite the project claims to prevent. | `records.py` `review_record`, `mongodb.py` |
| F4 | 🔴 | **Audit trail is not trustworthy yet.** (a) Three different audit shapes (`metadata` vs `details` vs `before/after`); (b) `performed_by` is an ObjectId in some places and a string in others; (c) review edits log no before→after; (d) "append-only" is only a convention — nothing prevents update/delete, and there is no tamper-evidence; (e) no `why` field. | `documents.py`, `records.py`, `audit_service.py` |
| F5 | 🔴 | **Queue read endpoints are unauthenticated.** `GET /api/v1/queue/` and `GET /api/v1/queue/{job_id}` have no `require_role`, and return full OCR text and extracted PII. | `queue.py` lines ~372–422 |
| F6 | 🔴 | **`/auth/dev-login` can mint an admin for anyone** when `DEV_LOGIN_ENABLED=true`, and the local `.env` has it `true`. Nothing stops this flag reaching production. | `auth.py` lines ~64–160, `.env` |
| F7 | 🔴 | **Frontend ↔ backend contract mismatch.** Frontend calls endpoints that do not exist on the backend: `/auth/login`, `/auth/refresh`, `/batches`, `/batches/upload`, `/admin/stats`, `/admin/officers`, `/map/parcels`, plus per-record field/audit/multilingual sub-routes. Backend has **no refresh-token route** at all. Frontend default base URL includes `/api/v1`, `.env` value does not. | `services.ts`, `main.py`, `auth.py` |
| F8 | 🟠 | **Processing runs synchronously inside the HTTP request** (read timeout 300 s). Hosted platforms commonly cut requests off well before that, and OCR on CPU is slow. There is no background worker and no automatic trigger after upload. | `queue.py` |
| F9 | 🟠 | **Job claim is not atomic** (`find_one` then `update_one`), so two clicks can start duplicate processing. Failed jobs cannot be retried cleanly; completed jobs can be re-run and overwrite results. | `queue.py` |
| F10 | 🟠 | **No document classification step**, no SHA-256 file digest (so exact-duplicate detection is impossible), and **no endpoint to fetch the original scan** back for the reviewer UI. | `documents.py` |
| F11 | 🟠 | **No auto-approval rules.** Flowchart has an Auto-Approve branch; today every record goes to a human. | `queue.py` |
| F12 | 🟠 | **No JSON/CSV export** and **no dashboard/readiness stats API** (the frontend `AdminPage` expects one). | `admin.py` has only user list/role |
| F13 | 🟠 | **Citizen lookup does a Python-side scan of ≤100 approved docs** and substring-matches in memory; it also reads the raw AI result rather than a verified record. No pagination, no index use, and it will silently miss records past 100. | `lookup.py` |
| F14 | 🟠 | **Records API is document-centric.** `GET /records` returns raw job results (including `raw_ocr` text); there is no "field + confidence + OCR evidence" shape for the review screen. | `records.py` |
| F15 | 🟠 | **No pending-verification handling** for citizens (they should see "pending", not nothing). | `lookup.py` |
| F16 | 🟠 | **AI service accepts PDF/DOCX in its README/MIME list but PDF conversion is listed as "Not started" in `backlog.md`.** Backend allows PDF upload, so a PDF upload will likely fail at OCR. Needs verification, then implementation (PyMuPDF is already a dependency). | `backlog.md`, `main.py` |

### Deployment & operations

| ID | Sev | Finding |
|---|---|---|
| F17 | 🔴 | **`docker-compose.yml` is broken:** it builds `./ai ocr pipeline` but the directory is `ai-service`. Compose also has no healthchecks, no `depends_on: condition`, no frontend service, and `IMPLEMENTATION.md` still refers to the old folder name and to `GEMINI_API_KEY` / `AI_INTERNAL_API_KEY` names that differ from the AI service's real `LLM_API_KEY` / `INTERNAL_API_KEY`. |
| F18 | 🔴 | **Secrets are present in the zip.** `ai-service/.env` contains a set Groq API key; `fastapi_backend/.env` contains an Atlas URI, JWT secret and Google client ID. They are not in git, but the zip has travelled. **Rotate the Groq key, Atlas DB password, JWT secrets and internal key before any deployment**, and stop sharing zips that include `.env`. |
| F19 | 🟠 | Backend `requirements.txt` is **UTF-16 LE** — pip tolerates a BOM, but many tools and CI steps don't. Convert to UTF-8. No pins for test deps; no `requirements-test.txt`. |
| F20 | 🟠 | Backend Dockerfile: runs as root, no healthcheck, no `.dockerignore`, copies `.env.example` into the image. |
| F21 | 🟠 | Startup is fail-fast on Mongo (good) but `/api/v1/health` never checks Mongo or the AI service, so a container can report "ok" while broken. No readiness vs liveness split. |
| F22 | 🟠 | Error handler uses `print("UNHANDLED ERROR…")`; no structured logging, no request IDs across backend → AI service, no log redaction of PII. |
| F23 | 🟠 | `CORS_ORIGINS` is a JSON list in env; `allow_credentials=True`; must be set to the real Vercel origin in production. Google OAuth redirect is hard-coded to `http://localhost:5173/login`. |
| F24 | 🟡 | JWTs are in `localStorage` (XSS-exposed). Acceptable for a hackathon demo if stated honestly; note as a known limitation. |
| F25 | 🟡 | Rate limiting uses in-memory slowapi (per-process); fine for one instance, not for scaled replicas. |
| F26 | 🟡 | Repo hygiene: loose `fake.pdf`, `malicious.pdf`, `oversized.pdf` (16 MB), `test.txt` in repo root; `ai-service/.venv` (1.1 GB) and `frontend/node_modules` inside the zip; `git diff` shows ~6,400 whole-file changes that are line-ending (CRLF/LF) churn, which will make PR review unreadable. |
| F27 | 🟡 | `GIS`/Map pages still run on mock data although the pitch deck excludes GIS from MVP scope. Either keep as clearly-labelled "Prototype" or hide behind a flag. |

### Things that are already good (keep, don't rewrite)

- Upload hardening: extension + MIME + **magic-byte** check, size cap, filename sanitising, rate limit.
- Original scan is stored in GridFS and never modified.
- JWT access/refresh split with separate secrets; `require_role` dependency; inactive-user check.
- AI service is stateless, has an adapter-pattern extractor (`mock`/`cloud`/`local`), a clean error envelope, and a `mock` mode that works offline.
- Dockerfile for the AI service pre-bakes OCR weights, has a healthcheck, runs as non-root, single worker.

---

## 3. Target architecture (what "deploy-ready" means)

```
React/Vite (Vercel)
      │  HTTPS, JWT
      ▼
FastAPI backend ──► MongoDB Atlas (users, documents, jobs, records, record_versions,
      │                              discrepancies, audit_logs)  + GridFS (originals)
      │  internal key
      ▼
AI service (Docker: OpenCV → PaddleOCR → LLM adapter)   [stateless]
```

Backend gets a proper service layer so each flowchart box is one testable module:

```
fastapi_backend/app/
  api/v1/          thin routers only
  services/
    ingestion_service.py        upload, sha256, gridfs, job creation
    classification_service.py   doc-type classifier (adapter; rule-based + mock)
    pipeline_service.py         orchestrates a job end to end (background)
    ai_client.py                AIExtractor interface + HttpAIExtractor + MockAIExtractor
    normalization_service.py    comparison-only normalisation
    validation_service.py       required / format / range / consistency rules
    conflict_service.py         existing-record check + duplicate/conflict classification
    approval_service.py         auto-approve rules + human decision + versioning
    record_service.py           verified records + immutable versions
    audit_service.py            single audit writer (who/what/when/why/before→after)
    export_service.py           JSON / CSV
    stats_service.py            dashboard + digitization-readiness
  core/  config.py (validated, prod-guards), logging.py, errors.py
```

---

## 4. Phased execution plan

Each task = **one PR-sized unit**: explain → files → implement → run/test commands → verify → next. Tasks are ordered so that the app is demonstrable after every phase.

### Phase A — Safe baseline (must be first)

| Task | Deliverable | Closes |
|---|---|---|
| A1 | **Repo hygiene**: normalise line endings (`.gitattributes`), delete root test artifacts (move fixtures to `fixtures/`), fix `.gitignore`, add `.dockerignore` files, convert `requirements.txt` to UTF-8, add `requirements-test.txt`. Ship the fix as its own commit so later diffs are readable. | F19, F26 |
| A2 | **Secrets & config hardening**: rotate keys (checklist for you), `config.py` validation (fail startup in `APP_ENV=production` if `DEV_LOGIN_ENABLED`, weak/default secrets, wildcard CORS, missing Google ID), unify env-var names, complete `.env.example` for all three services, real `/health` (liveness) + `/ready` (Mongo + AI reachable). | F6, F18, F21, F23 |
| A3 | **Close the open endpoints**: auth on all queue GETs, staff-only; audit sensitive reads. | F5 |
| A4 | **Test scaffold**: `pytest` + `mongomock-motor` + HTTPX `AsyncClient`, fixtures for users/roles/JWT/GridFS fake/AI mock. First tests cover current behaviour so refactors are safe. | F1 |

### Phase B — Trustworthy pipeline (the core differentiator)

| Task | Deliverable | Closes |
|---|---|---|
| B1 | **Unified audit service** — one writer; schema `{entity_type, entity_id, action, actor{id,role}, at, why, before, after, request_id, prev_hash, hash}`. Hash-chain each entry to the previous one and add a `verify_chain` endpoint/CLI so tampering is *detectable* (be honest in the pitch: tamper-evident, not tamper-proof). Route every existing direct `audit_logs.insert_one` through it. Indexes; no update/delete code paths. | F4 |
| B2 | **Ingestion upgrade**: SHA-256 digest, duplicate-upload detection, `GET /documents/{id}/file` (staff-only stream of original), classification adapter + result stored on the document. | F10 |
| B3 | **AI client adapter** (`AIExtractor` interface): `HttpAIExtractor` (current service), `MockAIExtractor` (deterministic, works without OCR so the whole flow demos anywhere). Normalise AI response → flat **field records** `{name, value, confidence, flagged, reason, ocr_evidence}`. | F14 |
| B4 | **Background processing + atomic claim**: `find_one_and_update` claim, retry/backoff, status machine (`queued → processing → completed/failed`), automatic trigger after upload, `GET /jobs/{id}` polling. Uses FastAPI background tasks / an asyncio worker loop inside the backend — **no Redis/Celery** (unnecessary for the hackathon; documented as roadmap). Job-recovery on startup for jobs stuck in `processing`. | F8, F9 |
| B5 | **Validation engine** — implement what `BACKEND_VALIDATION.md` specifies (required fields, identifier syntax, area units, confidence threshold, optional geography reference file). Use that document as the spec; do not silently change its rules. | F1, F2 |
| B6 | **Existing-record check + discrepancy detection** — candidate matching, classification (`same_document` / `duplicate_submission` / `possible_update` / `conflicting_information` / `insufficient_information`), idempotent evidence-keyed discrepancies. | F2 |
| B7 | **Approval engine**: configurable auto-approve rules (all fields ≥ threshold, zero validation errors, zero discrepancies, doc type known) with the reason recorded; otherwise route to review queue. Every decision audited, including auto-approval. | F11 |
| B8 | **Verified records + immutable versions**: on approval write `land_records` (current pointer) + `record_versions` (append-only snapshot with source document id, extraction, corrections, approver). Corrections never overwrite; a new version is created. Review endpoint gets `expected_version` (optimistic concurrency → 409 on stale writes). | F3 |

### Phase C — Access, review, export, dashboards

| Task | Deliverable | Closes |
|---|---|---|
| C1 | **Auth completion**: `/auth/refresh` with rotation + revocation list, `/auth/logout`, Google flow made env-driven (redirect URI from config), role assignment policy (first-login = citizen; officer/admin only via admin API or bootstrap key), dev-login guarded. | F6, F7, F23 |
| C2 | **Review workflow APIs**: review queue (filters: status, confidence, discrepancy), field-level correct/approve/flag, reviewer notes as `why`, reject with reason. | F14 |
| C3 | **Citizen lookup rewrite**: query `land_records` by survey/khasra/khata/village/district with indexes + pagination; return verification status and a "pending verification" state without leaking PII beyond agreed fields. | F13, F15 |
| C4 | **Admin & dashboard APIs**: stats (processed / verified / pending / failed, confidence distribution, review workload), digitization-readiness, officers list. Permission-controlled audit viewer. | F12 |
| C5 | **Export**: `GET /records/{id}/export?format=json|csv` and bulk export with filters; staff-only; audited. | F12 |
| C6 | **PDF support in AI service** (PyMuPDF, per `backlog.md`) and verify PDF end-to-end; fall back to a clear error, not a 500. | F16 |

### Phase D — Frontend integration

| Task | Deliverable | Closes |
|---|---|---|
| D1 | **Contract first**: generate/inspect `/openapi.json`, write a table "frontend call → backend route", then either add thin aliases on the backend or update `services.ts`. One source of truth: the backend OpenAPI. | F7 |
| D2 | Wire pages in order: Login → Upload (status polling) → Queue → Review (OCR evidence + confidence) → Discrepancy → Record detail (versions + audit) → Lookup → Admin. Set `VITE_USE_MOCKS=false` for real builds; keep mock mode only as an explicit demo fallback. | F7 |
| D3 | GIS/Map: label as prototype or hide behind `VITE_ENABLE_GIS`; align with the pitch deck. | F27 |
| D4 | Frontend error/loading states, token-refresh handling, `tsc -b` + `oxlint` clean, production build. | — |

### Phase E — Deployment

| Task | Deliverable | Closes |
|---|---|---|
| E1 | **Dockerization**: backend Dockerfile (non-root, healthcheck, pinned Python, multi-stage), fixed `docker-compose.yml` (correct paths, healthchecks, `depends_on: service_healthy`, named volumes, optional frontend service, `.env` per service), `docker compose up` works from a clean clone. | F17, F20 |
| E2 | **Observability**: structured JSON logs, request-ID propagation backend → AI service, PII-safe logging (never log OCR text or names), remove `print`. | F22 |
| E3 | **CI (GitHub Actions)**: backend pytest, AI-service fast pytest, frontend `tsc` + lint + build, Docker build check. Required to pass before merge. | — |
| E4 | **Production runbook** (`DEPLOYMENT.md`): env-var matrix per service, Atlas setup (least-privilege user, IP allowlist, backups), Vercel env, CORS/OAuth redirect URIs, secret rotation, smoke-test script, rollback steps. | F18, F23 |
| E5 | **Deploy + smoke test on the real hosts**; record a known-good demo dataset and a scripted demo path. | — |

### Phase F — Documentation & honesty pass

| Task | Deliverable |
|---|---|
| F-1 | Single source of truth doc (`ARCHITECTURE.md`) with decision log labelled **Implemented / Prototype-Mock / Future-Planned**; delete or fix stale statements in `IMPLEMENTATION.md` / `README.md`. |
| F-2 | "Known limitations" section (localStorage tokens, no cross-collection transactions, in-process job worker, heuristic matching, no authoritative geography data). Government API integration, offline batch, queue-based processing, and two-tier review stay **roadmap only** — not presented as delivered. No unsourced accuracy or time-saving numbers anywhere. |

---

## 5. Flowchart coverage map (nothing dropped)

| Flowchart step | Where it lands | Real or mock in v1 |
|---|---|---|
| Document upload | B2 (exists; extended) | Real |
| Document classification | B2 `classification_service` | Rule-based + mock adapter |
| Pre-processing | AI service `preprocessor.py` (exists) | Real |
| Multilingual OCR | AI service PaddleOCR hi+en (exists) | Real |
| AI structured extraction | AI service `extractor.py` (exists) | Real (Groq) / mock fallback |
| Field-level confidence | B3 normalised field records | Real |
| Validation | B5 | Real |
| Existing-record check | B6 | Real |
| Discrepancy detection | B6 | Real |
| Auto-approve / human review | B7, C2 | Real |
| Verified record | B8 | Real |
| Versioned audit trail | B1, B8 | Real (hash-chained) |
| Citizen/Admin access | C3, C4 | Real |
| JSON / CSV export | C5 | Real |

---

## 6. Definition of "deploy-ready" (exit criteria)

1. `docker compose up --build` from a clean clone brings up Mongo, backend, AI service (and optionally frontend); `/ready` is green.
2. A fresh officer can upload a sample scan → job runs in background → validation + discrepancy results appear → reviewer corrects a field → approval creates version 1 → citizen finds the record → export downloads → audit chain verifies.
3. Same flow works with `LLM_PROVIDER=mock` and with the AI service replaced by `MockAIExtractor` (demo-safe if Wi-Fi or Groq fails).
4. No unauthenticated endpoint returns PII; dev-login cannot be enabled when `APP_ENV=production`.
5. `pytest` (backend + AI fast tier) and frontend `tsc`/lint/build are green in CI.
6. All secrets rotated; nothing sensitive in the repo or in shared archives.
7. Docs match the code; limitations are stated plainly.

---

## 7. Risks and how the plan handles them

| Risk | Mitigation |
|---|---|
| OCR quality on real degraded Devanagari scans is unknown | Confidence-gated review is the safety net; ship a small labelled fixture set and report *observed* behaviour only, never invented accuracy numbers. |
| AI host RAM/cold starts (PaddleOCR ~1.2 GB) | Pick a host tier with enough RAM; weights pre-baked; `MockAIExtractor` fallback for demos. |
| Groq/LLM outage or rate limit during judging | Mock mode + cached demo results; retry/backoff in B4. |
| MongoDB has no multi-document transactions in our current usage | Use conditional updates + idempotent keys; consider Atlas transactions for the approve→version write (single replica set supports them); document the limit. |
| Scope creep | Each task is independently shippable; anything not in the flowchart or the exit criteria is deferred. |

---

## 8. Environment conventions for the work

- Windows + VS Code integrated terminal + **PowerShell 5.1** (no `Invoke-RestMethod -Form`; multipart via `curl.exe` or manual bytes).
- Each command in its own code block.
- Only new/changed files are delivered per task; **new dependencies are called out explicitly** each time.
- Migrations: none needed for Mongo, but index changes ship as an idempotent `create_indexes()` update.
- Never print or paste secret values in chat or logs.