from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.dependencies import require_role
from app.db.mongodb import get_db


router = APIRouter()


class ReviewUpdate(BaseModel):
    location_details: dict[str, Any] | None = None
    land_identifiers: dict[str, Any] | None = None
    land_details: dict[str, Any] | None = None
    ownership_details: dict[str, Any] | None = None
    review_notes: str | None = Field(default=None, max_length=2000)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, dict):
        return {key: _serialize(item) for key, item in value.items()}

    if isinstance(value, list):
        return [_serialize(item) for item in value]

    return value


@router.get("/")
async def list_records(
    current_user=Depends(
        require_role("reviewer", "officer", "admin")
    ),
):
    db = get_db()

    documents = await db.documents.find(
        {"status": {"$in": ["needs_review", "verified", "approved"]}}
    ).sort(
        "updated_at",
        -1,
    ).limit(50).to_list(length=50)

    items = []

    for document in documents:
        document_id = document.get("document_id")

        job = await db.processing_jobs.find_one(
            {"document_id": document_id},
            sort=[("created_at", -1)],
        )

        items.append(
            {
                "document_id": document_id,
                "filename": document.get("filename"),
                "status": document.get("status"),
                "uploaded_by": document.get("uploaded_by"),
                "created_at": document.get("created_at"),
                "updated_at": document.get("updated_at"),
                "job_id": job.get("job_id") if job else None,
                "result": job.get("result") if job else None,
            }
        )

    return {
        "items": [_serialize(item) for item in items],
        "count": len(items),
    }


@router.get("/{record_id}")
async def get_record(
    record_id: str,
    current_user=Depends(
        require_role("reviewer", "officer", "admin")
    ),
):
    db = get_db()

    document = await db.documents.find_one(
        {"document_id": record_id}
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found",
        )

    job = await db.processing_jobs.find_one(
        {"document_id": record_id},
        sort=[("created_at", -1)],
    )

    return _serialize(
        {
            "document": document,
            "processing_job": job,
        }
    )


@router.patch("/{record_id}/review")
async def review_record(
    record_id: str,
    payload: ReviewUpdate,
    current_user=Depends(
        require_role("reviewer", "admin")
    ),
):
    db = get_db()

    document = await db.documents.find_one(
        {"document_id": record_id}
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found",
        )

    if document.get("status") not in {
        "needs_review",
        "under_review",
    }:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Record is not available for review. "
                f"Current status: {document.get('status')}"
            ),
        )

    job = await db.processing_jobs.find_one(
        {"document_id": record_id},
        sort=[("created_at", -1)],
    )

    if not job or not job.get("result"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No processed result is available for this record",
        )

    result = job["result"]

    extraction = result.get("extraction", {})

    if payload.location_details is not None:
        extraction["location_details"] = payload.location_details

    if payload.land_identifiers is not None:
        extraction["land_identifiers"] = payload.land_identifiers

    if payload.land_details is not None:
        extraction["land_details"] = payload.land_details

    if payload.ownership_details is not None:
        extraction["ownership_details"] = payload.ownership_details

    result["extraction"] = extraction

    result["review"] = {
        "reviewed_by": str(current_user["_id"]),
        "reviewed_at": _utc_now(),
        "notes": payload.review_notes,
    }

    result["status"] = "verified"

    now = _utc_now()

    await db.processing_jobs.update_one(
        {"job_id": job["job_id"]},
        {
            "$set": {
                "result": result,
                "status": "completed",
                "updated_at": now,
            }
        },
    )

    await db.documents.update_one(
        {"document_id": record_id},
        {
            "$set": {
                "status": "verified",
                "updated_at": now,
                "reviewed_by": str(current_user["_id"]),
                "reviewed_at": now,
            }
        },
    )

    await db.audit_logs.insert_one(
        {
            "action": "record_reviewed",
            "entity_type": "document",
            "entity_id": record_id,
            "user_id": str(current_user["_id"]),
            "details": {
                "job_id": job["job_id"],
                "previous_status": document.get("status"),
                "new_status": "verified",
                "review_notes": payload.review_notes,
            },
            "timestamp": now,
        }
    )

    return {
        "document_id": record_id,
        "job_id": job["job_id"],
        "status": "verified",
        "reviewed_by": str(current_user["_id"]),
        "reviewed_at": now,
    }


@router.patch("/{record_id}/approve")
async def approve_record(
    record_id: str,
    current_user=Depends(
        require_role("reviewer", "admin")
    ),
):
    db = get_db()

    document = await db.documents.find_one(
        {"document_id": record_id}
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found",
        )

    if document.get("status") != "verified":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Record must be verified by a reviewer "
                "before approval"
            ),
        )

    now = _utc_now()

    await db.documents.update_one(
        {"document_id": record_id},
        {
            "$set": {
                "status": "approved",
                "approved_by": str(current_user["_id"]),
                "approved_at": now,
                "updated_at": now,
            }
        },
    )

    await db.audit_logs.insert_one(
        {
            "action": "record_approved",
            "entity_type": "document",
            "entity_id": record_id,
            "user_id": str(current_user["_id"]),
            "details": {
                "previous_status": "verified",
                "new_status": "approved",
            },
            "timestamp": now,
        }
    )

    return {
        "document_id": record_id,
        "status": "approved",
        "approved_by": str(current_user["_id"]),
        "approved_at": now,
    }


@router.patch("/{record_id}/reject")
async def reject_record(
    record_id: str,
    current_user=Depends(
        require_role("reviewer", "admin")
    ),
):
    db = get_db()

    document = await db.documents.find_one(
        {"document_id": record_id}
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found",
        )

    now = _utc_now()

    await db.documents.update_one(
        {"document_id": record_id},
        {
            "$set": {
                "status": "rejected",
                "rejected_by": str(current_user["_id"]),
                "rejected_at": now,
                "updated_at": now,
            }
        },
    )

    await db.audit_logs.insert_one(
        {
            "action": "record_rejected",
            "entity_type": "document",
            "entity_id": record_id,
            "user_id": str(current_user["_id"]),
            "details": {
                "previous_status": document.get("status"),
                "new_status": "rejected",
            },
            "timestamp": now,
        }
    )

    return {
        "document_id": record_id,
        "status": "rejected",
        "rejected_by": str(current_user["_id"]),
        "rejected_at": now,
    }