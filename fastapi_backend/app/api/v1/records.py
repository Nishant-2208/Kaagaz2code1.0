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


def _is_empty_review_data(value: Any) -> bool:
    """
    Detect empty/default Swagger-generated objects such as:

    {
        "additionalProp1": {}
    }

    These should not overwrite existing extracted data.
    """
    if value is None:
        return True

    if not isinstance(value, dict):
        return False

    if not value:
        return True

    if set(value.keys()) == {"additionalProp1"}:
        return not bool(value.get("additionalProp1"))

    return False


def _merge_section(
    existing: dict[str, Any],
    updates: dict[str, Any] | None,
) -> dict[str, Any]:
    """
    Preserve existing extraction values and update only meaningful
    values supplied by the reviewer.
    """
    if _is_empty_review_data(updates):
        return existing

    merged = dict(existing)

    for key, value in updates.items():
        if value is not None:
            merged[key] = value

    return merged


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


@router.patch("/{record_id}/draft")
async def save_record_draft(
    record_id: str,
    payload: ReviewUpdate,
    current_user=Depends(
        require_role("officer", "reviewer", "admin")
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
        "verified",
    }:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Record is not available for draft editing. "
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

    if not isinstance(extraction, dict):
        extraction = {}

    for section_name, incoming in (
        ("location_details", payload.location_details),
        ("land_identifiers", payload.land_identifiers),
        ("land_details", payload.land_details),
        ("ownership_details", payload.ownership_details),
    ):
        existing = extraction.get(section_name, {})
        if not isinstance(existing, dict):
            existing = {}
        extraction[section_name] = _merge_section(
            existing,
            incoming,
        )

    result["extraction"] = extraction

    now = _utc_now()
    previous_status = document.get("status")

    await db.processing_jobs.update_one(
        {"job_id": job["job_id"]},
        {
            "$set": {
                "result": result,
                "updated_at": now,
            }
        },
    )

    await db.documents.update_one(
        {"document_id": record_id},
        {
            "$set": {
                "updated_at": now,
            }
        },
    )

    await db.audit_logs.insert_one(
        {
            "action": "record_draft_saved",
            "entity_type": "document",
            "entity_id": record_id,
            "user_id": str(current_user["_id"]),
            "details": {
                "job_id": job["job_id"],
                "previous_status": previous_status,
                "new_status": previous_status,
                "review_notes": payload.review_notes,
            },
            "timestamp": now,
        }
    )

    return {
        "document_id": record_id,
        "job_id": job["job_id"],
        "status": previous_status,
        "saved_at": now,
    }


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

    if not isinstance(extraction, dict):
        extraction = {}

    existing_location_details = extraction.get(
        "location_details",
        {},
    )

    existing_land_identifiers = extraction.get(
        "land_identifiers",
        {},
    )

    existing_land_details = extraction.get(
        "land_details",
        {},
    )

    existing_ownership_details = extraction.get(
        "ownership_details",
        {},
    )

    if not isinstance(existing_location_details, dict):
        existing_location_details = {}

    if not isinstance(existing_land_identifiers, dict):
        existing_land_identifiers = {}

    if not isinstance(existing_land_details, dict):
        existing_land_details = {}

    if not isinstance(existing_ownership_details, dict):
        existing_ownership_details = {}

    extraction["location_details"] = _merge_section(
        existing_location_details,
        payload.location_details,
    )

    extraction["land_identifiers"] = _merge_section(
        existing_land_identifiers,
        payload.land_identifiers,
    )

    extraction["land_details"] = _merge_section(
        existing_land_details,
        payload.land_details,
    )

    extraction["ownership_details"] = _merge_section(
        existing_ownership_details,
        payload.ownership_details,
    )

    result["extraction"] = extraction

    now = _utc_now()

    result["review"] = {
        "reviewed_by": str(current_user["_id"]),
        "reviewed_at": now,
        "notes": payload.review_notes,
    }

    result["status"] = "verified"

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