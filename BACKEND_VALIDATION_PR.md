# Add backend validation and conflict detection

## What changed

The processing flow previously trusted AI status without checking business validity or comparing existing records. This adds backend validation before completion, structured discrepancies with exact evidence, and review/approval gates. Original OCR values and existing records are preserved.

## Files changed

- `app/services/normalization_service.py`: comparison-only Unicode, identifier and area normalization.
- `app/services/validation_service.py`: pure required-field, value, confidence and reference-based consistency rules.
- `app/services/conflict_service.py`: conservative duplicate/update/conflict classification.
- `app/services/validation_policy.py`: optional deployment-owned geography and identifier policy.
- `app/services/validation_workflow.py`: candidate reads, evidence-keyed discrepancies, audit events and reports.
- `app/api/v1/queue.py`: validation integration, conditional claims, completed-record protection and staff-only reads.
- `app/api/v1/records.py`: correction audit snapshots and validation gates for verification/approval.
- `tests/`, `pytest.ini`, `requirements-test.txt`: rule and HTTP workflow tests.
- `docs/BACKEND_VALIDATION.md`: technical analysis, compatibility, operational notes and limitations.

Paths beginning `app/` or `tests/` are relative to `fastapi_backend/`.

## Validation rules

Check missing required fields, distinct survey/khasra/khata identifiers, malformed structured values, positive area with known units, confidence and AI flags. Geography checks use only an explicitly configured authoritative reference. No extraction fields are invented.

## Duplicate detection

Use exact document SHA-256 when available, otherwise exact normalized district/tehsil/village plus multiple independent same-type identifiers. Weak matches remain uncertain. Distinguish identical document, duplicate submission, possible update, conflicting information and insufficient information; require reviewer acknowledgement of matches.

## Conflict detection

Preserve existing/new owner, area and identifier values plus the related document ID. Do not overwrite matched records. Recheck before approval to catch candidates added after processing. Resolutions are tied to exact issue evidence and do not waive future changed conflicts.

## Tests

`python -m pytest -q` from `fastapi_backend`: **52 passed**, two upstream deprecation warnings. Includes required ten scenarios, persistence/idempotence, resolution/correction behavior, audit, citizen/staff RBAC, JWT, upload/process/review/lookup, failure handling and concurrent rejection preservation.

Live startup was attempted but no MongoDB server/Atlas credentials were available. HTTP tests use simulated MongoDB/GridFS and AI transport; real OAuth/OCR and production durability are unverified.

## Compatibility

No endpoint paths/request models/top-level success response shapes changed. Queue reads now require staff authorization. Jobs add internal validation reports; generated discrepancies can become `superseded`. Review saves corrections but returns 409 when issues remain. Approval revalidates and blocks unresolved issues. Completed records require a new submission for reprocessing. Existing architecture and core auth/RBAC remain unchanged.

## Known limitations

No authoritative geography dataset bundled; full candidate scan needs an indexed projection at scale; legacy files lack hashes; no cross-record transaction/locking guarantees; live Atlas/GridFS/OAuth/AI checks remain outstanding. Existing frontend integration problems are outside scope. See the technical note for details.