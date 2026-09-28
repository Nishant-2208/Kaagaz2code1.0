from typing import Any, Literal

from fastapi import APIRouter, Query

from app.db.mongodb import get_db


router = APIRouter()


def _serialize(value: Any) -> Any:
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
async def lookup(
    q: str = Query(..., min_length=1, max_length=100),
    search_type: Literal["khasra", "owner", "village"] = Query(
        default="khasra",
        alias="type",
    ),
    limit: int = Query(default=20, ge=1, le=50),
):
    db = get_db()

    search = q.strip()

    if not search:
        return {
            "query": q,
            "type": search_type,
            "items": [],
            "count": 0,
        }

    # Citizen-facing search only considers approved records.
    documents = await db.documents.find(
        {"status": "approved"}
    ).limit(100).to_list(length=100)

    items = []

    for document in documents:
        document_id = document.get("document_id")

        job = await db.processing_jobs.find_one(
            {
                "document_id": document_id,
                "status": "completed",
            },
            sort=[("completed_at", -1)],
        )

        if not job:
            continue

        result = job.get("result") or {}
        extraction = result.get("extraction") or {}

        location = extraction.get("location_details") or {}
        identifiers = extraction.get("land_identifiers") or {}
        land = extraction.get("land_details") or {}
        ownership = extraction.get("ownership_details") or {}

        if search_type == "owner":
            searchable_values = [
                ownership.get("landowner_name"),
            ]
        elif search_type == "village":
            searchable_values = [
                location.get("village"),
            ]
        else:
            searchable_values = [
                identifiers.get("survey_number"),
                identifiers.get("khasra_number"),
                identifiers.get("khata_number"),
            ]

        searchable_text = " ".join(
            str(value)
            for value in searchable_values
            if value is not None
        ).casefold()

        if search.casefold() not in searchable_text:
            continue

        items.append(
            {
                "document_id": document_id,
                "status": "approved",
                "location_details": location,
                "land_identifiers": identifiers,
                "land_details": land,
                "ownership_details": {
                    "landowner_name": ownership.get(
                        "landowner_name"
                    ),
                    "registration_information": ownership.get(
                        "registration_information"
                    ),
                    "mutation_records": ownership.get(
                        "mutation_records"
                    ),
                },
            }
        )

        if len(items) >= limit:
            break

    return {
        "query": q,
        "type": search_type,
        "items": [_serialize(item) for item in items],
        "count": len(items),
    }
