from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.dependencies import require_role
from app.db.mongodb import get_db


router = APIRouter()


class RoleUpdate(BaseModel):
    role: str


ALLOWED_ROLES = {
    "citizen",
    "officer",
    "reviewer",
    "admin",
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, dict):
        return {
            key: _serialize(item)
            for key, item in value.items()
        }

    if isinstance(value, list):
        return [_serialize(item) for item in value]

    return value


@router.get("/users")
async def list_users(
    limit: int = Query(default=50, ge=1, le=200),
    current_user=Depends(
        require_role("admin")
    ),
):
    db = get_db()

    users = await db.users.find(
        {}
    ).sort(
        "created_at",
        -1,
    ).limit(limit).to_list(length=limit)

    items = []

    for user in users:
        items.append(
            {
                "_id": user.get("_id"),
                "name": user.get("name"),
                "email": user.get("email"),
                "role": user.get("role"),
                "google_id": user.get("google_id"),
                "created_at": user.get("created_at"),
                "updated_at": user.get("updated_at"),
            }
        )

    return {
        "items": [_serialize(item) for item in items],
        "count": len(items),
    }


@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    current_user=Depends(
        require_role("admin")
    ),
):
    db = get_db()

    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid user ID",
        )

    user = await db.users.find_one(
        {"_id": ObjectId(user_id)}
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return _serialize(
        {
            "_id": user.get("_id"),
            "name": user.get("name"),
            "email": user.get("email"),
            "role": user.get("role"),
            "google_id": user.get("google_id"),
            "created_at": user.get("created_at"),
            "updated_at": user.get("updated_at"),
        }
    )


@router.patch("/users/{user_id}/role")
async def change_role(
    user_id: str,
    payload: RoleUpdate,
    current_user=Depends(
        require_role("admin")
    ),
):
    db = get_db()

    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid user ID",
        )

    if payload.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid role. Allowed roles: "
                "citizen, officer, reviewer, admin"
            ),
        )

    target_user = await db.users.find_one(
        {"_id": ObjectId(user_id)}
    )

    if not target_user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    previous_role = target_user.get("role")
    now = _utc_now()

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "role": payload.role,
                "updated_at": now,
            }
        },
    )

    await db.audit_logs.insert_one(
        {
            "action": "user_role_changed",
            "entity_type": "user",
            "entity_id": user_id,
            "user_id": str(current_user["_id"]),
            "details": {
                "previous_role": previous_role,
                "new_role": payload.role,
            },
            "timestamp": now,
        }
    )

    return {
        "user_id": user_id,
        "previous_role": previous_role,
        "new_role": payload.role,
        "status": "updated",
        "updated_at": now,
    }