from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.dependencies import require_role
from app.db.mongodb import get_db


router = APIRouter()


class DiscrepancyCreate(BaseModel):
    document_id: str
    field: str = Field(min_length=1, max_length=200)
    discrepancy_type: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=2000)
    ai_value: Any = None
    expected_value: Any = None
    severity: str = "medium"


class DiscrepancyResolve(BaseModel):
    resolution: str = Field(min_length=1, max_length=2000)
    corrected_value: Any = None


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
async def list_discrepancies(
    current_user=Depends(
        require_role("reviewer", "officer", "admin")
    ),
):
    db = get_db()

    discrepancies = await db.discrepancies.find(
        {}
    ).sort(
        "created_at",
        -1,
    ).limit(100).to_list(length=100)

    return {
        "items": [_serialize(item) for item in discrepancies],
        "count": len(discrepancies),
    }


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
)
async def create_discrepancy(
    payload: DiscrepancyCreate,
    current_user=Depends(
        require_role("reviewer", "officer", "admin")
    ),
):
    db = get_db()

    document = await db.documents.find_one(
        {"document_id": payload.document_id}
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    now = _utc_now()

    discrepancy = {
        "document_id": payload.document_id,
        "field": payload.field,
        "discrepancy_type": payload.discrepancy_type,
        "description": payload.description,
        "ai_value": payload.ai_value,
        "expected_value": payload.expected_value,
        "severity": payload.severity,
        "status": "open",
        "created_by": str(current_user["_id"]),
        "created_at": now,
        "updated_at": now,
    }

    result = await db.discrepancies.insert_one(discrepancy)

    discrepancy["_id"] = result.inserted_id

    await db.audit_logs.insert_one(
        {
            "action": "discrepancy_created",
            "entity_type": "discrepancy",
            "entity_id": str(result.inserted_id),
            "user_id": str(current_user["_id"]),
            "details": {
                "document_id": payload.document_id,
                "field": payload.field,
                "discrepancy_type": payload.discrepancy_type,
                "severity": payload.severity,
            },
            "timestamp": now,
        }
    )

    return _serialize(discrepancy)


@router.get("/{discrepancy_id}")
async def get_discrepancy(
    discrepancy_id: str,
    current_user=Depends(
        require_role("reviewer", "officer", "admin")
    ),
):
    db = get_db()

    if not ObjectId.is_valid(discrepancy_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid discrepancy ID",
        )

    discrepancy = await db.discrepancies.find_one(
        {"_id": ObjectId(discrepancy_id)}
    )

    if not discrepancy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discrepancy not found",
        )

    return _serialize(discrepancy)


@router.patch("/{discrepancy_id}/resolve")
async def resolve_discrepancy(
    discrepancy_id: str,
    payload: DiscrepancyResolve,
    current_user=Depends(
        require_role("reviewer", "admin")
    ),
):
    db = get_db()

    if not ObjectId.is_valid(discrepancy_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid discrepancy ID",
        )

    discrepancy = await db.discrepancies.find_one(
        {"_id": ObjectId(discrepancy_id)}
    )

    if not discrepancy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discrepancy not found",
        )

    if discrepancy.get("status") == "resolved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Discrepancy is already resolved",
        )

    now = _utc_now()

    await db.discrepancies.update_one(
        {"_id": ObjectId(discrepancy_id)},
        {
            "$set": {
                "status": "resolved",
                "resolution": payload.resolution,
                "corrected_value": payload.corrected_value,
                "resolved_by": str(current_user["_id"]),
                "resolved_at": now,
                "updated_at": now,
            }
        },
    )

    await db.audit_logs.insert_one(
        {
            "action": "discrepancy_resolved",
            "entity_type": "discrepancy",
            "entity_id": discrepancy_id,
            "user_id": str(current_user["_id"]),
            "details": {
                "document_id": discrepancy.get("document_id"),
                "field": discrepancy.get("field"),
                "resolution": payload.resolution,
                "corrected_value": payload.corrected_value,
            },
            "timestamp": now,
        }
    )

    return {
        "discrepancy_id": discrepancy_id,
        "status": "resolved",
        "resolved_by": str(current_user["_id"]),
        "resolved_at": now,
    }