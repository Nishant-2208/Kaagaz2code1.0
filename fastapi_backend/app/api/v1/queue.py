import uuid
from datetime import datetime, timezone

# pyrefly: ignore [missing-import]
from bson import ObjectId
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.config import settings
from app.core.dependencies import require_role
from app.core.rate_limit import limiter
from app.db.mongodb import get_db, get_gridfs_bucket
from app.services.audit_service import append_audit


router = APIRouter()


AI_SERVICE_TIMEOUT = httpx.Timeout(
    connect=10,
    read=300,
    write=60,
    pool=10,
)


# ---------------------------------------------------------------------------
# MongoDB serialization helper
# ---------------------------------------------------------------------------

def serialize_mongo_value(value):
    """
    Recursively convert MongoDB-specific values into JSON-safe values.
    """

    if isinstance(value, ObjectId):
        return str(value)

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, dict):
        return {
            key: serialize_mongo_value(item)
            for key, item in value.items()
        }

    if isinstance(value, list):
        return [
            serialize_mongo_value(item)
            for item in value
        ]

    return value


# ---------------------------------------------------------------------------
# Process queue job
# ---------------------------------------------------------------------------

@router.post("/{job_id}/process")
@limiter.limit("5/minute")
async def process_queue_job(
    request: Request,
    job_id: str,
    current_user=Depends(
        require_role(
            "officer",
            "admin",
        )
    ),
):
    db = get_db()
    bucket = get_gridfs_bucket()

    job = await db.processing_jobs.find_one(
        {"job_id": job_id}
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Processing job not found.",
        )

    if job.get("status") == "processing":
        raise HTTPException(
            status_code=409,
            detail="Processing job is already running.",
        )

    document_id = job.get("document_id")

    if not document_id:
        raise HTTPException(
            status_code=400,
            detail="Processing job does not contain a document ID.",
        )

    document = await db.documents.find_one(
        {"document_id": document_id}
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Associated document not found.",
        )

    gridfs_id = document.get("gridfs_id")

    if not gridfs_id:
        raise HTTPException(
            status_code=400,
            detail="Document does not contain a GridFS file ID.",
        )

    # -----------------------------------------------------------------------
    # Mark job as processing
    # -----------------------------------------------------------------------

    await db.processing_jobs.update_one(
        {"job_id": job_id},
        {
            "$set": {
                "status": "processing",
                "started_at": datetime.now(timezone.utc),
            },
            "$unset": {
                "error": "",
            },
        },
    )

    await db.documents.update_one(
        {"document_id": document_id},
        {
            "$set": {
                "status": "processing",
            }
        },
    )

    try:
        # -------------------------------------------------------------------
        # Read document from MongoDB GridFS
        # -------------------------------------------------------------------

        grid_out = await bucket.open_download_stream(
            gridfs_id
        )

        file_bytes = await grid_out.read()

        filename = document.get(
            "filename",
            "document",
        )

        content_type = document.get(
            "content_type",
            "application/octet-stream",
        )

        # -------------------------------------------------------------------
        # Prepare AI service request
        # -------------------------------------------------------------------

        headers = {
            "X-Request-Id": str(uuid.uuid4()),
        }

        if settings.ai_internal_api_key:
            headers["X-Internal-Key"] = (
                settings.ai_internal_api_key
            )

        files = {
            "file": (
                filename,
                file_bytes,
                content_type,
            )
        }

        data = {
            "doc_type": "land_record",
        }

        # -------------------------------------------------------------------
        # Send document to AI/OCR service
        # -------------------------------------------------------------------

        async with httpx.AsyncClient(
            timeout=AI_SERVICE_TIMEOUT
        ) as client:

            response = await client.post(
                f"{settings.ocr_service_url}/process-document",
                headers=headers,
                files=files,
                data=data,
            )

        # -------------------------------------------------------------------
        # Handle AI service failure
        # -------------------------------------------------------------------

        if response.status_code >= 400:

            await db.processing_jobs.update_one(
                {"job_id": job_id},
                {
                    "$set": {
                        "status": "failed",
                        "error": response.text[:2000],
                        "completed_at": datetime.now(
                            timezone.utc
                        ),
                    }
                },
            )

            await db.documents.update_one(
                {"document_id": document_id},
                {
                    "$set": {
                        "status": "failed",
                    }
                },
            )

            raise HTTPException(
                status_code=502,
                detail=(
                    "AI/OCR service failed "
                    "to process the document."
                ),
            )

        # -------------------------------------------------------------------
        # Parse AI result
        # -------------------------------------------------------------------

        ai_result = response.json()

        # -------------------------------------------------------------------
        # Save complete AI result
        # -------------------------------------------------------------------

        await db.processing_jobs.update_one(
            {"job_id": job_id},
            {
                "$set": {
                    "status": "completed",
                    "result": ai_result,
                    "completed_at": datetime.now(
                        timezone.utc
                    ),
                },
                "$unset": {
                    "error": "",
                },
            },
        )

        # -------------------------------------------------------------------
        # Determine document status (via Validation Engine)
        # -------------------------------------------------------------------

        from app.services.validation_service import validate_ai_extraction
        
        document_status = await validate_ai_extraction(
            db=db,
            document_id=document_id,
            job_id=job_id,
            ai_result=ai_result,
            user_id=str(current_user["_id"])
        )

        await db.documents.update_one(
            {"document_id": document_id},
            {
                "$set": {
                    "status": document_status,
                }
            },
        )

        # -------------------------------------------------------------------
        # Audit processing completion
        # -------------------------------------------------------------------

        await append_audit(
            action="processing_completed",
            entity_type="processing_job",
            entity_id=job_id,
            performed_by=str(
                current_user["_id"]
            ),
            user_id=str(
                current_user["_id"]
            ),
            details={
                "document_id": document_id,
                "status": document_status,
            },
        )

        # -------------------------------------------------------------------
        # Response
        # -------------------------------------------------------------------

        return {
            "success": True,
            "job_id": job_id,
            "document_id": document_id,
            "status": "completed",
            "document_status": document_status,
            "result": ai_result,
        }

    except HTTPException:
        raise

    except Exception as exc:

        # Temporary diagnostic logging.
        print(
            f"QUEUE PROCESSING ERROR: {repr(exc)}",
            flush=True,
        )

        # Mark processing job as failed.
        await db.processing_jobs.update_one(
            {"job_id": job_id},
            {
                "$set": {
                    "status": "failed",
                    "error": str(exc)[:2000],
                    "completed_at": datetime.now(
                        timezone.utc
                    ),
                }
            },
        )

        # Mark document as failed.
        await db.documents.update_one(
            {"document_id": document_id},
            {
                "$set": {
                    "status": "failed",
                }
            },
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to process the document.",
        )


# ---------------------------------------------------------------------------
# List processing jobs
# ---------------------------------------------------------------------------

@router.get("/")
async def list_processing_jobs():
    db = get_db()

    jobs = await (
        db.processing_jobs
        .find({})
        .sort("created_at", -1)
        .limit(50)
        .to_list(length=50)
    )

    jobs = [
        serialize_mongo_value(job)
        for job in jobs
    ]

    return {
        "success": True,
        "count": len(jobs),
        "jobs": jobs,
    }


# ---------------------------------------------------------------------------
# Get processing job
# ---------------------------------------------------------------------------

@router.get("/{job_id}")
async def get_processing_job(
    job_id: str,
):
    db = get_db()

    job = await db.processing_jobs.find_one(
        {"job_id": job_id}
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Processing job not found.",
        )

    # Recursively convert ObjectId and datetime
    # values throughout the complete MongoDB document.
    job = serialize_mongo_value(job)

    return {
        "success": True,
        "job": job,
    }