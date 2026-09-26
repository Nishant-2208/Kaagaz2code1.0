from datetime import datetime, timezone
from typing import Any

from app.db.mongodb import get_db


async def append_audit(
    entity_type: str,
    entity_id: str,
    action: str,
    performed_by: str,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    user_id: str | None = None,
    details: dict[str, Any] | None = None,
):
    await get_db().audit_logs.insert_one(
        {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "performed_by": performed_by,
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc),
            "before": before,
            "after": after,
            "details": details,
        }
    )