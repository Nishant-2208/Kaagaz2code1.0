# -*- coding: utf-8 -*-
"""
process_queued_jobs.py
======================
Processes all jobs currently in 'queued' status using the
running FastAPI backend + Mock AI service.

Usage:
    python process_queued_jobs.py [--max N]

Default: processes up to 5 queued jobs.
"""

import asyncio
import json
import sys
import argparse

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import httpx

BACKEND_URL = "http://localhost:8000"
DEV_EMAIL   = "officer@kaagaz.dev"
DEV_NAME    = "Revenue Officer"
DEV_ROLE    = "officer"

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RESET  = "\033[0m"


async def get_token(client: httpx.AsyncClient) -> str | None:
    r = await client.post(
        f"{BACKEND_URL}/api/v1/auth/dev-login",
        json={"email": DEV_EMAIL, "name": DEV_NAME, "role": DEV_ROLE},
        timeout=15,
    )
    if r.status_code == 200:
        return r.json().get("access_token")
    print(f"{RED}Login failed: {r.text[:300]}{RESET}")
    return None


async def get_queued_jobs(client: httpx.AsyncClient, token: str) -> list[dict]:
    headers = {"Authorization": f"Bearer {token}"}
    r = await client.get(f"{BACKEND_URL}/api/v1/queue/", headers=headers, timeout=15)
    if r.status_code == 200:
        jobs = r.json().get("jobs", [])
        return [j for j in jobs if j.get("status") == "queued"]
    return []


async def process_job(client: httpx.AsyncClient, token: str, job: dict) -> bool:
    headers = {"Authorization": f"Bearer {token}"}
    job_id  = job.get("job_id")
    doc_id  = job.get("document_id", "?")
    print(f"  Processing job {job_id} (doc: {doc_id}) ...", end=" ")
    try:
        r = await client.post(
            f"{BACKEND_URL}/api/v1/queue/{job_id}/process",
            headers=headers,
            timeout=120,
        )
        body = r.json()
        if r.status_code == 200 and body.get("success"):
            doc_status = body.get("document_status", "?")
            print(f"{GREEN}OK{RESET} -> doc_status={doc_status}")
            return True
        else:
            err = body.get("detail", r.text[:200])
            print(f"{RED}FAILED{RESET} -> {err}")
            return False
    except Exception as e:
        print(f"{RED}ERROR{RESET} -> {e}")
        return False


async def main(max_jobs: int):
    print(f"\n{CYAN}Processing queued jobs (max={max_jobs}){RESET}\n")

    async with httpx.AsyncClient(follow_redirects=True) as client:
        token = await get_token(client)
        if not token:
            return

        queued = await get_queued_jobs(client, token)
        to_process = queued[:max_jobs]
        print(f"Found {len(queued)} queued job(s). Processing {len(to_process)} ...\n")

        passed = failed = 0
        for job in to_process:
            if await process_job(client, token, job):
                passed += 1
            else:
                failed += 1

        print(f"\n{GREEN}Passed: {passed}{RESET}  {RED}Failed: {failed}{RESET}  Total: {passed+failed}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--max", type=int, default=5, help="Max jobs to process")
    args = parser.parse_args()
    asyncio.run(main(args.max))
