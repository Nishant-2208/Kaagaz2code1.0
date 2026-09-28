# Backend validation: technical analysis and implementation

Baseline: `eb1eae5605d98caf9df920415337b1d36896b565` on `main`.
Feature branch: `backend-validation`.

## Initial technical analysis

1. Architecture: existing Python FastAPI backend, Motor/MongoDB, GridFS, JWT and dependency-based RBAC. AI extraction remains a separate FastAPI service. No replacement backend is needed.
2. Relevant existing files: `app/api/v1/{documents,queue,records,discrepancies,audit}.py`, `app/db/mongodb.py`, and `app/services/audit_service.py`.
3. Flow: upload saves GridFS bytes, document metadata and a queued job. The process endpoint reads GridFS, calls `/process-document`, stores the AI response in `processing_jobs.result`, and updates document status. Review edits that result; approval updates `documents`. Despite the declared collection names/indexes, current canonical record data is not written to `land_records`.
4. Discrepancies: one existing MongoDB collection, with create/list/get/resolve routes and officer/reviewer/admin permissions. Resolution stores a reason and optional correction; applying field changes remains the review route's responsibility.
5. Audit: existing append-only application helper supports actor, before/after, details and timestamps. Some existing routes also insert audit events directly. Both remain in place.
6. Placement: pure normalization, validation and candidate comparison services, plus a persistence integration service behind existing queue/review/approval routes.
7. Rules: required fields, independent parcel identifiers, structured value types, identifier syntax, positive area with explicit unit, confidence, optional authoritative geography.
8. Duplicates: exact file digest when available; otherwise exact normalized location and multiple independent, same-type identifiers. Weak matches remain uncertain.
9. Conflicts: compare owner, area, identifiers and other extracted values on matched candidates. Preserve old/new values and related document ID. Never overwrite another record.
10. Tests: all ten requested rule scenarios, persistence, repeatability, reviewer decisions, audit, access control and HTTP processing/review flow.

Before modification, live local startup was attempted and failed with `ServerSelectionTimeoutError`: no local MongoDB daemon or configured Atlas connection was available. With simulated MongoDB, startup/index creation, health, JWT current-user lookup, records, discrepancies and citizen lookup returned 200; unauthenticated records returned 401.

## Rules and comparison policy

Default required values: village, district, landowner name, plot area, khata number, and at least one of survey or khasra. Neither survey nor khasra is synthesized from the other. A deployment can require either independently through the optional policy file.

Identifier comparisons preserve leading zeroes and separator semantics. Unicode NFC, whitespace/case normalization, decimal-digit normalization and spacing around `/` and `-` are used only for comparison. No transliteration, phonetic matching or fuzzy matching is performed. Identifiers need a numeric component; unrecognised local identifier formats are flagged for review, not rewritten.

Areas use Decimal and explicit known units: hectares/à¤¹à¥‡à¤•à¥à¤Ÿà¥‡à¤¯à¤°, square metres/à¤µà¤°à¥à¤— à¤®à¥€à¤Ÿà¤°, and acres/à¤à¤•à¤¡à¤¼. Regional units such as bigha, unitless numbers, comma decimals, non-positive values and malformed inputs require review. Original extraction values are retained.

Confidence below 0.75, absent/invalid overall confidence, malformed flags, or any AI field flag require review. Confidence is evidence, never a substitute for correctness.

A strong record candidate needs equal district, tehsil and village plus at least two equal distinct identifiers, including survey or khasra. Matching khata alone is not proof that parcels are identical. Full location plus a shared parcel and differing khata creates a potential identifier conflict while retaining an insufficient-identity classification. Different known locations are not silently merged. Missing identity data generates an explicit review issue even if no candidate is found.

Candidate classifications:

- `same_document`: matching SHA-256 bytes; separate content conflicts can still exist.
- `duplicate_submission`: strongly matching record data; not proof of identical source bytes.
- `possible_update`: matching identity/core values with changed optional information.
- `conflicting_information`: differing owner, area, location or identifiers on strong evidence.
- `insufficient_information`: possible match without enough independent evidence.

Candidates are read from current documents and their latest completed processing job. All eligible records are streamed; none are excluded by a fixed result cap. Rejected/failed/processing documents are not authoritative comparison records.

## Optional geography reference

No authoritative Indian district/tehsil dataset was supplied. Default reports explicitly say `geography_check: not_configured`; they do not claim geographic consistency was checked.

Set `VALIDATION_REFERENCE_PATH` to a reviewed, deployment-owned UTF-8 JSON file with:

```json
{
  "source": "Name of the authoritative source",
  "version": "Dataset revision",
  "district_tehsils": {},
  "required_identifiers": ["khata_number"]
}
```

Populate `district_tehsils` with district names mapped to complete lists of valid tehsils for those districts. The source/version must be nonempty if the mapping is populated. Unknown districts are not assumed invalid. A configured but malformed/unreadable file fails validation closed. Reports record a fingerprint of the effective policy. No reference data or secrets are committed.

## Persistence and audit

The AI result stays in `processing_jobs.result`; backend findings are stored separately in `processing_jobs.validation`. This adds no new route or discrepancy database. Generated discrepancies use the existing shape and add source, rule version, stable evidence key and related document ID.

Deterministic ObjectIds derived from document/rule/evidence fingerprints make repeated validation idempotent for discrepancy creation. Explicit reviewer resolutions remain effective only for the same evidence. Changed evidence creates new issues. Obsolete open generated issues become `superseded`, with audit events. Reappearing superseded evidence reopens. Manual issues are never automatically changed.

Validation, issue creation/supersession/reopening and correction events use the existing audit helper. Correction audit events include original and corrected extraction snapshots. Existing upload, review, approval and resolution audit behavior is retained.

## API compatibility and intentional behavior changes

Existing endpoint paths, request models and top-level successful response shapes are preserved. No changes to React, OAuth, JWT code, core RBAC, MongoDB connection, GridFS implementation, AI code or deployment configuration.

Intentional changes:

- Queue GET routes now require officer/reviewer/admin authorization (401/403 otherwise), because jobs contain internal OCR/validation evidence.
- Job responses contain an additive nested `validation` report. Document internals may include file digest and validation revision metadata.
- `/review` saves corrections and logs them, then validates. If open issues remain, it returns 409 with a message that corrections were saved; the document remains `needs_review`. Resolve issues through the existing endpoint and submit review again.
- Review resolutions are human acknowledgement of exact evidence. They never make a conflicted extraction eligible for automatic progression.
- `/approve` revalidates against current candidates. Open issues move the record to `needs_review`, create an audit event and return 409.
- Completed document results cannot be reprocessed in place. Only uploaded/failed documents with queued/failed jobs can run; submit a new document for a revision. Job claiming is conditional to stop duplicate processing starts.
- Review and approval use conditional updates to detect changed document state/revision. A rejection during validation cannot be overwritten by final verification.
- Existing discrepancy consumers must tolerate `superseded` on generated issues. Resolved and superseded issues remain available for history.
- Citizen lookup/map projections remain unchanged and do not expose validation reports.

Clean data is marked eligible in the report, but the existing AI `ok` â†’ human-review workflow is intentionally preserved. This change never automatically approves land ownership.

## Tests and execution

From the backend directory:

```bash
python -m pip install -r requirements.txt -r requirements-test.txt
python -m pytest -q
```

Observed result: **52 passed**, with two upstream Starlette/httpx/AnyIO deprecation warnings. No new runtime dependency was added.

Tests include the ten requested scenarios, Hindi/digit/unit normalization, malformed extraction/confidence, configurable geography, durable discrepancies, repeat validation, resolution invalidation on changed evidence, manual issue preservation, audit events, approval rechecks, JWT and role enforcement, upload/process/review/public lookup, duplicate bytes, failed validation storage, running-job rejection and concurrent rejection preservation.

HTTP tests use real application routes, JWT decoding and role dependencies with mongomock-motor, a simulated GridFS bucket and HTTPX AI transport. They do NOT establish live Atlas/GridFS durability, Google OAuth behavior, real OCR/LLM accuracy, or production concurrency safety.

## Known limitations and deployment gates

- Live Atlas startup, real GridFS/OCR processing and Google OAuth still require configured services and must be verified before deployment.
- Geographic checks require an authoritative reference supplied by the deployment owner; no such data was available here.
- The current extraction schema has no state/jurisdiction code. Matching is conservative but remains heuristic, not legal identity determination.
- Legacy documents without stored file digests cannot be identified as byte-identical without re-reading their original files. Record-level comparison still works.
- Candidate lookup is a full streaming scan with per-document job reads. An indexed comparison projection/backfill is needed at production scale.
- Multi-collection writes and audit inserts retain the existing non-transactional architecture. Conditional updates reduce individual races but do not provide cross-record serializability. Simultaneous new submissions/approvals or database failure between writes need transactional/locking recovery design and live concurrency tests before production use.
- Reviewer resolution stores acknowledgement/corrected value in the discrepancy; it does not automatically apply that value to extraction. Apply corrections through the existing review payload.
- The project's earlier frontend/backend API mismatches, OAuth configuration issues and deployment-path issues are outside this assignment and remain unchanged.