"""
main.py — FastAPI wiring for the SIH26018 land-record extraction microservice.

Endpoints:
    GET  /health            liveness + readiness (never touches the model)
    GET  /v1/meta           engine/model/schema versions — the frontend badge
    POST /process-document  the pipeline

Run:
    uvicorn main:app --port 8001 --reload
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, Final

import anyio
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()

import extractor as ex  # noqa: E402  — must follow load_dotenv()
import ocr_engine  # noqa: E402
import preprocessor  # noqa: E402

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
)
logger = logging.getLogger("ai-service")

SERVICE_NAME: Final[str] = "sih26018-ai-service"
MAX_FILE_MB: Final[int] = int(os.getenv("MAX_FILE_MB", "15"))
MAX_FILE_BYTES: Final[int] = MAX_FILE_MB * 1024 * 1024
INTERNAL_API_KEY: Final[str] = os.getenv("INTERNAL_API_KEY", "")
ACCEPTED_MIME: Final[set[str]] = {
    "image/jpeg", "image/jpg", "image/png", "image/tiff", "image/bmp", "image/webp",
    "image/pjpeg", "image/x-png",
    "application/pdf", "application/x-pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword", "application/docx", "application/x-docx",
    "application/octet-stream",
}
ACCEPTED_EXTENSIONS: Final[set[str]] = {
    ".pdf", ".docx", ".doc", ".jpeg", ".jpg", ".png", ".tiff", ".tif", ".bmp", ".webp",
}

_state: dict[str, Any] = {"ocr_ready": False, "started_at": time.time()}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm OCR weights and construct the extractor before traffic arrives.

    Both are done defensively: a failure here downgrades /health to not-ready
    rather than crash-looping the container, which on a free-tier host means the
    difference between a debuggable 503 and a dead service at demo time.
    """
    logger.info("Starting %s (schema %s)", SERVICE_NAME, ex.SCHEMA_VERSION)
    try:
        ex.build_extractor()
    except ex.ExtractorConfigError as exc:
        logger.error("Extractor misconfigured: %s", exc)

    # Run warmup in the background so the service binds immediately and answers /health
    # (reporting status: degraded / ocr_ready: false until warmup finishes).
    async def _async_warmup():
        try:
            ready = await anyio.to_thread.run_sync(ocr_engine.warmup)
            _state["ocr_ready"] = bool(ready)
            logger.info("Startup complete. ocr_ready=%s", _state["ocr_ready"])
        except Exception as exc:
            logger.error("OCR warmup failed: %s", exc)
            _state["ocr_ready"] = False

    warmup_task = asyncio.create_task(_async_warmup())
    yield
    warmup_task.cancel()
    logger.info("Shutting down %s", SERVICE_NAME)


app = FastAPI(
    title="SIH26018 — Land Record Extraction Service",
    version=ex.SCHEMA_VERSION,
    lifespan=lifespan,
)

# The main backend is the only intended caller; localhost origins are for the
# dev frontend hitting this service directly while the backend is still a stub.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _error(request_id: str, status: int, code: str, message: str, retryable: bool = False) -> JSONResponse:
    """Uniform error envelope — same shape for every failure mode."""
    logger.warning("[%s] %d %s: %s", request_id, status, code, message)
    return JSONResponse(
        status_code=status,
        content={"request_id": request_id, "error": {"code": code, "message": message, "retryable": retryable}},
        headers={"X-Request-Id": request_id},
    )


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """Propagate the caller's correlation id so one grep spans both services."""
    rid = request.headers.get("X-Request-Id") or uuid.uuid4().hex[:16]
    request.state.request_id = rid
    response = await call_next(request)
    response.headers["X-Request-Id"] = rid
    return response


@app.get("/health")
async def health() -> JSONResponse:
    """Liveness + readiness. Deliberately does not run inference."""
    ready = _state["ocr_ready"]
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "service": SERVICE_NAME,
            "status": "ok" if ready else "degraded",
            "ocr_ready": ready,
            "uptime_s": int(time.time() - _state["started_at"]),
        },
    )


@app.get("/v1/meta")
async def meta() -> dict[str, Any]:
    """What the UI shows as the 'cloud / air-gapped' badge."""
    try:
        engine = ex.build_extractor()
        llm_name, llm_mode = engine.name, engine.mode
    except ex.ExtractorConfigError as exc:
        llm_name, llm_mode = f"unconfigured ({exc})", "none"
    return {
        "service": SERVICE_NAME,
        "schema_version": ex.SCHEMA_VERSION,
        "ocr": {"engine": "paddleocr-2.7.3", "langs": ocr_engine.OCR_LANGS, "ready": _state["ocr_ready"]},
        "llm": {"model": llm_name, "mode": llm_mode, "timeout_s": ex.LLM_TIMEOUT_S},
        "limits": {
            "max_file_mb": MAX_FILE_MB,
            "accepted_mime": sorted(ACCEPTED_MIME),
            "accepted_extensions": sorted(ACCEPTED_EXTENSIONS),
        },
        "confidence_floor": ex.CONFIDENCE_FLOOR,
    }


@app.post("/process-document")
async def process_document(
    request: Request,
    file: UploadFile = File(..., description="Land record file (PDF, DOCX, JPEG, PNG, etc.)"),
    doc_type: str = Form("land_record"),
) -> JSONResponse:
    """Preprocess -> OCR -> LLM extraction -> scored JSON.

    Returns 200 for both clean and low-confidence extractions; `status` carries
    the distinction ("ok" vs "needs_review"). Low confidence is a business
    outcome, not a transport error — making it a 4xx would force every caller to
    re-implement the same branching.
    """
    rid: str = request.state.request_id
    started = time.perf_counter()

    if INTERNAL_API_KEY and request.headers.get("X-Internal-Key") != INTERNAL_API_KEY:
        return _error(rid, 401, "UNAUTHORIZED", "Missing or invalid X-Internal-Key.")

    # --- read + validate upload -------------------------------------------
    try:
        raw = await file.read()
    except Exception as exc:
        return _error(rid, 400, "BAD_REQUEST", f"Could not read upload: {exc}")
    finally:
        await file.close()

    if len(raw) > MAX_FILE_BYTES:
        return _error(rid, 413, "FILE_TOO_LARGE", f"File is {len(raw)/1e6:.1f}MB; limit is {MAX_FILE_MB}MB.")

    ct = (file.content_type or "").lower().strip()
    fname = file.filename or ""
    ext = os.path.splitext(fname)[1].lower() if fname else ""

    if ct and ct not in ACCEPTED_MIME and ext not in ACCEPTED_EXTENSIONS:
        return _error(
            rid, 415, "UNSUPPORTED_MEDIA_TYPE",
            f"Got {file.content_type}; expected one of {sorted(ACCEPTED_EXTENSIONS)}.",
        )

    # --- 1. preprocess -----------------------------------------------------
    try:
        pre = await anyio.to_thread.run_sync(preprocessor.preprocess, raw, fname)
    except preprocessor.ImageDecodeError as exc:
        return _error(rid, 400, "IMAGE_DECODE_FAILED", str(exc))
    except Exception as exc:
        logger.exception("[%s] preprocessing crashed", rid)
        return _error(rid, 500, "PREPROCESSING_ERROR", f"Unexpected preprocessing failure: {exc}")

    # --- 2. OCR / text extraction ------------------------------------------
    if pre.direct_text:
        # Native digital text extracted from DOCX or digital PDF
        direct_lines = [
            ocr_engine.OcrLine(
                text=l.strip(),
                confidence=0.99,
                box=[[0, i * 30], [pre.width, i * 30], [pre.width, (i + 1) * 30], [0, (i + 1) * 30]],
                lang="hi" if any("\u0900" <= c <= "\u097f" for c in l) else "en",
            )
            for i, l in enumerate(pre.direct_text.splitlines()) if l.strip()
        ]
        ocr = ocr_engine.OcrResult(
            lines=direct_lines,
            full_text=pre.direct_text,
            mean_confidence=0.99,
            engine_ms=1,
            langs=ocr_engine.OCR_LANGS,
        )
    else:
        try:
            ocr = await anyio.to_thread.run_sync(ocr_engine.extract_text, pre.ocr_input)
        except ocr_engine.OcrFailure:
            return _error(
                rid, 422, "OCR_NO_TEXT",
                "No readable text found. The document may be blank, inverted, or too low-resolution.",
            )
        except ocr_engine.OcrEngineUnavailable as exc:
            _state["ocr_ready"] = False
            return _error(rid, 503, "MODEL_LOADING", f"OCR engine unavailable: {exc}", retryable=True)
        except Exception as exc:
            logger.exception("[%s] OCR crashed", rid)
            return _error(rid, 500, "OCR_ERROR", f"Unexpected OCR failure: {exc}")

    # --- 3. LLM extraction -------------------------------------------------
    weak = [l.text for l in ocr.lines if l.confidence < 0.6]
    try:
        engine = ex.build_extractor()
        result = await engine.extract(
            ocr_text=ocr.full_text,
            ocr_mean_conf=ocr.mean_confidence,
            weak_lines=weak,
            doc_type=doc_type,
            image_illegible=pre.is_likely_illegible,
        )
    except ex.ExtractorConfigError as exc:
        return _error(rid, 500, "EXTRACTOR_MISCONFIGURED", str(exc))
    except ex.LLMTimeoutError as exc:
        return _error(rid, 504, "LLM_TIMEOUT", str(exc), retryable=True)
    except ex.LLMUpstreamError as exc:
        retryable = "rate limited" in str(exc).lower()
        return _error(rid, 502, "LLM_UPSTREAM_ERROR", str(exc), retryable=retryable)
    except ex.LLMResponseError as exc:
        return _error(rid, 502, "LLM_INVALID_RESPONSE", str(exc), retryable=True)
    except Exception as exc:
        logger.exception("[%s] extraction crashed", rid)
        return _error(rid, 500, "EXTRACTION_ERROR", f"Unexpected extraction failure: {exc}")

    # --- 4. respond --------------------------------------------------------
    conf = result.confidence_scores
    status = "ok" if (conf.overall_confidence >= ex.CONFIDENCE_FLOOR and not conf.flagged_fields) else "needs_review"
    elapsed_ms = int((time.perf_counter() - started) * 1000)

    logger.info(
        "[%s] done status=%s conf=%.3f flagged=%d ocr_lines=%d %dms",
        rid, status, conf.overall_confidence, len(conf.flagged_fields), len(ocr.lines), elapsed_ms,
    )

    return JSONResponse(
        status_code=200,
        content={
            "request_id": rid,
            "status": status,
            "processing_ms": elapsed_ms,
            "engine": {
                "ocr": "paddleocr-2.7.3",
                "ocr_langs": ocr.langs,
                "llm": engine.name,
                "mode": engine.mode,
                "schema_version": ex.SCHEMA_VERSION,
            },
            "extraction": result.model_dump(),
            "raw_ocr": {
                "text": ocr.full_text,
                "mean_ocr_confidence": ocr.mean_confidence,
                "line_count": len(ocr.lines),
                "ocr_ms": ocr.engine_ms,
            },
            "image_meta": {
                "width": pre.width,
                "height": pre.height,
                "skew_corrected_deg": pre.skew_angle_deg,
                "blur_score": pre.blur_score,
                "likely_illegible": pre.is_likely_illegible,
            },
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8001")), reload=False)
