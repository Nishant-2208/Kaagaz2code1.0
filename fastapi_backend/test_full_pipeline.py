# -*- coding: utf-8 -*-
"""
test_full_pipeline.py
=====================
End-to-end integration test for the Kaagaz2Code document pipeline.

Tests (in order):
  1. FastAPI backend health
  2. Mock AI service health
  3. Dev login (officer role)
  4. Document upload (POST /api/v1/documents/upload)
  5. Queue processing (POST /api/v1/queue/{job_id}/process)
  6. Job status verification
  7. Existing queued jobs report

Usage:
    python test_full_pipeline.py

Requirements:
  - FastAPI backend running at http://localhost:8000
  - Mock AI service running at http://localhost:8001
"""

import asyncio
import json
import sys

# Force UTF-8 on Windows consoles (fixes cp1252 issues)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import httpx

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BACKEND_URL = "http://localhost:8000"
AI_URL      = "http://localhost:8001"

DEV_EMAIL = "officer@kaagaz.dev"
DEV_NAME  = "Revenue Officer"
DEV_ROLE  = "officer"

# Minimal but valid PDF (passes magic-bytes check in documents.py)
MINIMAL_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
    b"xref\n0 4\n0000000000 65535 f \n"
    b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n9\n%%EOF\n"
)

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RESET  = "\033[0m"
SEP    = "=" * 60
SEP2   = "-" * 60

_passed = 0
_failed = 0


def ok(msg: str):
    global _passed
    _passed += 1
    print(f"  {GREEN}[PASS]{RESET} {msg}")


def fail(msg: str, detail: str = ""):
    global _failed
    _failed += 1
    print(f"  {RED}[FAIL]{RESET} {msg}")
    if detail:
        print(f"    {RED}>> {detail}{RESET}")


def info(msg: str):
    print(f"  {CYAN}[INFO]{RESET} {msg}")


def section(title: str):
    print(f"\n{YELLOW}{SEP2}{RESET}")
    print(f"{YELLOW}  {title}{RESET}")
    print(f"{YELLOW}{SEP2}{RESET}")


# ---------------------------------------------------------------------------
# Individual test functions
# ---------------------------------------------------------------------------

async def test_backend_health(client: httpx.AsyncClient):
    section("1. FastAPI Backend Health")
    try:
        r = await client.get(f"{BACKEND_URL}/api/v1/health", timeout=10)
        if r.status_code == 200:
            ok(f"Backend is up -- {r.json()}")
        else:
            fail("Backend health returned non-200", f"status={r.status_code} body={r.text[:200]}")
    except Exception as e:
        fail("Cannot reach FastAPI backend (is it running on port 8000?)", str(e))


async def test_ai_service_health(client: httpx.AsyncClient):
    section("2. Mock AI Service Health")
    try:
        r = await client.get(f"{AI_URL}/health", timeout=10)
        body = r.json()
        if body.get("ocr_ready"):
            ok(f"AI service is up and ready -- {body}")
        else:
            info(f"AI service responded (ocr_ready={body.get('ocr_ready')}) -- {body}")
    except Exception as e:
        fail("Cannot reach AI service (is mock_ai_service.py running on port 8001?)", str(e))


async def test_dev_login(client: httpx.AsyncClient) -> str | None:
    section("3. Dev Login (officer role)")
    try:
        r = await client.post(
            f"{BACKEND_URL}/api/v1/auth/dev-login",
            json={"email": DEV_EMAIL, "name": DEV_NAME, "role": DEV_ROLE},
            timeout=15,
        )
        if r.status_code == 200:
            data = r.json()
            token = data.get("access_token")
            user  = data.get("user", {})
            ok(f"Logged in as {user.get('name')} ({user.get('role')})")
            info(f"User ID: {user.get('id')}")
            return token
        else:
            fail("Dev login failed", f"status={r.status_code} body={r.text[:400]}")
            return None
    except Exception as e:
        fail("Dev login exception", str(e))
        return None


async def test_upload_document(client: httpx.AsyncClient, token: str) -> tuple[str | None, str | None]:
    section("4. Document Upload")
    headers = {"Authorization": f"Bearer {token}"}
    try:
        r = await client.post(
            f"{BACKEND_URL}/api/v1/documents/upload",
            headers=headers,
            files={"file": ("test_land_record.pdf", MINIMAL_PDF, "application/pdf")},
            timeout=30,
        )
        if r.status_code == 201:
            data = r.json()
            doc_id = data.get("document_id")
            job_id = data.get("job_id")
            ok(f"Document uploaded successfully")
            info(f"document_id      : {doc_id}")
            info(f"job_id           : {job_id}")
            info(f"filename         : {data.get('filename')}")
            info(f"size_bytes       : {data.get('size_bytes')}")
            info(f"processing_status: {data.get('processing_status')}")
            return doc_id, job_id
        else:
            fail("Upload failed", f"status={r.status_code} body={r.text[:500]}")
            return None, None
    except Exception as e:
        fail("Upload exception", str(e))
        return None, None


async def test_queue_process(client: httpx.AsyncClient, token: str, job_id: str) -> dict | None:
    section("5. Queue Processing (POST /api/v1/queue/{job_id}/process)")
    headers = {"Authorization": f"Bearer {token}"}
    info(f"Sending job {job_id} to AI service ...")
    try:
        r = await client.post(
            f"{BACKEND_URL}/api/v1/queue/{job_id}/process",
            headers=headers,
            timeout=120,
        )
        body = r.json()
        if r.status_code == 200 and body.get("success"):
            ok("Processing completed successfully!")
            info(f"job status      : {body.get('status')}")
            info(f"document status : {body.get('document_status')}")
            ai = body.get("result", {})
            info(f"AI status       : {ai.get('status')}")
            extraction = ai.get("extraction", {})
            conf = extraction.get("confidence_scores", {})
            info(f"Confidence      : {conf.get('overall_confidence')}")
            info(f"Flagged fields  : {conf.get('flagged_fields')}")
            loc = extraction.get("location_details", {})
            info(f"Location        : village={loc.get('village')} district={loc.get('district')}")
            owner = extraction.get("ownership_details", {})
            info(f"Landowner       : {owner.get('landowner_name')}")
            return body
        else:
            fail(
                "Processing failed",
                f"status={r.status_code}\n    body={json.dumps(body, indent=4)[:800]}",
            )
            return None
    except Exception as e:
        fail("Processing exception", str(e))
        return None


async def test_job_status(client: httpx.AsyncClient, token: str, job_id: str):
    section("6. Verify Job Status via GET /api/v1/queue/{job_id}")
    headers = {"Authorization": f"Bearer {token}"}
    try:
        r = await client.get(f"{BACKEND_URL}/api/v1/queue/{job_id}", headers=headers, timeout=15)
        if r.status_code == 200:
            job = r.json().get("job", {})
            status = job.get("status")
            if status == "completed":
                ok("Job status is 'completed'")
            else:
                fail(f"Job status is '{status}' (expected 'completed')")
            info(f"started_at   : {job.get('started_at')}")
            info(f"completed_at : {job.get('completed_at')}")
            error = job.get("error")
            if error:
                fail("Job has error field set", error[:300])
            else:
                ok("No error field on job")
        else:
            fail("Get job failed", f"status={r.status_code} body={r.text[:300]}")
    except Exception as e:
        fail("Get job exception", str(e))


async def test_existing_queued_jobs(client: httpx.AsyncClient, token: str):
    section("7. Existing Queued Jobs Summary")
    headers = {"Authorization": f"Bearer {token}"}
    try:
        r = await client.get(f"{BACKEND_URL}/api/v1/queue/", headers=headers, timeout=15)
        if r.status_code == 200:
            jobs = r.json().get("jobs", [])
            by_status: dict[str, list] = {}
            for j in jobs:
                s = j.get("status", "unknown")
                by_status.setdefault(s, []).append(j.get("job_id", "?"))

            info(f"Total jobs in DB: {len(jobs)}")
            for status, ids in sorted(by_status.items()):
                indicator = GREEN if status == "completed" else (YELLOW if status == "queued" else RED)
                print(f"    {indicator}{status}{RESET}: {len(ids)} job(s)")

            queued = by_status.get("queued", [])
            if queued:
                info(f"Queued job IDs (ready to process with /api/v1/queue/<id>/process):")
                for jid in queued[:5]:
                    print(f"    {jid}")
                if len(queued) > 5:
                    info(f"... and {len(queued)-5} more queued jobs")
        else:
            fail("List jobs failed", f"status={r.status_code} body={r.text[:300]}")
    except Exception as e:
        fail("List jobs exception", str(e))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main():
    print(f"\n{CYAN}{SEP}{RESET}")
    print(f"{CYAN}  Kaagaz2Code -- Full Pipeline Integration Test{RESET}")
    print(f"{CYAN}  Backend : {BACKEND_URL}{RESET}")
    print(f"{CYAN}  AI Svc  : {AI_URL}{RESET}")
    print(f"{CYAN}{SEP}{RESET}")

    async with httpx.AsyncClient(follow_redirects=True) as client:
        await test_backend_health(client)
        await test_ai_service_health(client)

        token = await test_dev_login(client)
        if not token:
            print(f"\n{RED}Cannot proceed without auth token.{RESET}")
            return

        doc_id, job_id = await test_upload_document(client, token)
        if not job_id:
            print(f"\n{RED}Cannot proceed without a valid job_id.{RESET}")
        else:
            result = await test_queue_process(client, token, job_id)
            if result:
                await test_job_status(client, token, job_id)

        await test_existing_queued_jobs(client, token)

    section("TEST SUMMARY")
    total = _passed + _failed
    print(f"  Passed : {GREEN}{_passed}{RESET} / {total}")
    print(f"  Failed : {RED}{_failed}{RESET} / {total}")
    if _failed == 0:
        print(f"\n  {GREEN}All tests passed! Pipeline is working end-to-end.{RESET}\n")
    else:
        print(f"\n  {RED}{_failed} test(s) failed -- see details above.{RESET}\n")


if __name__ == "__main__":
    asyncio.run(main())
