"""
mock_ai_service.py — Drop-in replacement for the real AI/OCR service.

Run on port 8001 when the real ai-service is not available:
    python mock_ai_service.py

Matches the full response schema expected by:
  - fastapi_backend/app/api/v1/queue.py  (process_queue_job)
  - fastapi_backend/app/services/validation_service.py
  - fastapi_backend/app/services/conflict_service.py

Also handles:
  - X-Internal-Key header auth (passes through any key)
  - doc_type form field
  - /health endpoint (returns ocr_ready: true)
  - /v1/meta endpoint
"""

import os
import time
import uuid

import uvicorn
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "local-dev-key")

app = FastAPI(title="Mock AI Service", version="1.0.0")

_started_at = time.time()


@app.get("/health")
async def health():
    """Liveness check — always reports ready so queue.py can proceed."""
    return JSONResponse(
        status_code=200,
        content={
            "service": "sih26018-ai-service-MOCK",
            "status": "ok",
            "ocr_ready": True,
            "uptime_s": int(time.time() - _started_at),
        },
    )


@app.get("/v1/meta")
async def meta():
    return {
        "service": "sih26018-ai-service-MOCK",
        "schema_version": "1.0",
        "ocr": {"engine": "mock", "langs": ["en", "hi"], "ready": True},
        "llm": {"model": "mock-llm", "mode": "mock", "timeout_s": 45},
        "limits": {
            "max_file_mb": 15,
            "accepted_extensions": [".pdf", ".jpg", ".jpeg", ".png", ".tiff"],
        },
        "confidence_floor": 0.75,
    }


@app.post("/process-document")
async def process_document(
    request: Request,
    file: UploadFile = File(...),
    doc_type: str = Form("land_record"),
):
    """
    Mock OCR/LLM extraction endpoint.

    Returns a deterministic response that:
    - Has status "ok" (confidence above floor, no flagged fields)
    - Contains all required fields for validation_service.py
    - Passes the X-Internal-Key check if set
    """
    # --- Auth check (mirrors real service) ---
    if INTERNAL_API_KEY:
        incoming_key = request.headers.get("X-Internal-Key", "")
        if incoming_key != INTERNAL_API_KEY:
            return JSONResponse(
                status_code=401,
                content={
                    "request_id": "mock",
                    "error": {
                        "code": "UNAUTHORIZED",
                        "message": "Missing or invalid X-Internal-Key.",
                        "retryable": False,
                    },
                },
            )

    rid = request.headers.get("X-Request-Id") or uuid.uuid4().hex[:16]

    # Read and discard the file bytes (we're mocking)
    raw = await file.read()
    await file.close()

    filename = file.filename or "document.pdf"
    size_kb = len(raw) / 1024

    return JSONResponse(
        status_code=200,
        content={
            "request_id": rid,
            "status": "ok",
            "processing_ms": 420,
            "engine": {
                "ocr": "mock-ocr",
                "ocr_langs": ["en", "hi"],
                "llm": "mock-llm",
                "mode": "mock",
                "schema_version": "1.0",
            },
            "extraction": {
                "location_details": {
                    "village": "Rampur",
                    "tehsil": "Sadar",
                    "district": "Lucknow",
                },
                "land_identifiers": {
                    "survey_number": "SRV-2026-001",
                    "khasra_number": "215/4",
                    "khata_number": "408",
                },
                "land_details": {
                    "plot_area": "2.35 hectare",
                    "land_classification": "Agricultural (Irrigated)",
                },
                "ownership_details": {
                    "landowner_name": "Ramesh Kumar",
                    "registration_information": "REG-UP-2026-00123",
                    "mutation_records": "MUT-2026-9041",
                },
                "confidence_scores": {
                    "overall_confidence": 0.92,
                    "flagged_fields": [],
                },
            },
            "raw_ocr": {
                "text": (
                    f"[MOCK OCR] File: {filename} | Size: {size_kb:.1f} KB | "
                    f"doc_type: {doc_type}\n"
                    "Sample land record text extracted by mock OCR engine.\n"
                    "Village: Rampur | District: Lucknow | Khasra: 215/4"
                ),
                "mean_ocr_confidence": 0.95,
                "line_count": 12,
                "ocr_ms": 180,
            },
            "image_meta": {
                "width": 2480,
                "height": 3508,
                "skew_corrected_deg": 0.3,
                "blur_score": 82.5,
                "likely_illegible": False,
            },
        },
        headers={"X-Request-Id": rid},
    )


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    print(f"Starting Mock AI Service on port {port}")
    print(f"INTERNAL_API_KEY: {'set' if INTERNAL_API_KEY else 'not set'}")
    uvicorn.run(app, host="127.0.0.1", port=port, reload=False)
