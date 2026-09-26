from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import require_role
from app.db.mongodb import get_db


router = APIRouter()


def _serialize(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)

    if hasattr(value, "isoformat"):
        return value.isoformat()

    if isinstance(value, dict):
        return {
            key: _serialize(item)
            for key, item in value.items()
        }

    if isinstance(value, list):
        return [_serialize(item) for item in value]

    return value


@router.get("/")
async def list_audit_logs(
    entity_type: str | None = Query(default=None),
    entity_id: str | None = Query(default=None),
    action: str | None = Query(default=None),
    performed_by: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    current_user=Depends(
        require_role("reviewer", "admin")
    ),
):
    db = get_db()

    query: dict[str, Any] = {}

    if entity_type:
        query["entity_type"] = entity_type

    if entity_id:
        query["entity_id"] = entity_id

    if action:
        query["action"] = action

    # Newer audit entries use performed_by.
    # Older entries use user_id.
    if performed_by:
        query["performed_by"] = performed_by
    elif user_id:
        query["$or"] = [
            {"performed_by": user_id},
            {"user_id": user_id},
        ]

    logs = await db.audit_logs.find(
        query
    ).sort(
        "timestamp",
        -1,
    ).limit(limit).to_list(length=limit)

    return {
        "items": [_serialize(log) for log in logs],
        "count": len(logs),
    }


@router.get("/{audit_id}")
async def get_audit_log(
    audit_id: str,
    current_user=Depends(
        require_role("reviewer", "admin")
    ),
):
    db = get_db()

    if not ObjectId.is_valid(audit_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid audit ID",
        )

    log = await db.audit_logs.find_one(
        {"_id": ObjectId(audit_id)}
    )

    if not log:
        raise HTTPException(
            status_code=404,
            detail="Audit log not found",
        )

    return _serialize(log)