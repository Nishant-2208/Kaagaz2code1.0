from typing import Any

from fastapi import APIRouter, Query

from app.db.mongodb import get_db

router = APIRouter()


def _serialize(value: Any) -> Any:
    if hasattr(value, "isoformat"):
        return value.isoformat()

    if isinstance(value, dict):
        return {key: _serialize(item) for key, item in value.items()}

    if isinstance(value, list):
        return [_serialize(item) for item in value]

    return value


@router.get("/parcels")
async def map_records(
    q: str | None = Query(default=None, max_length=200),
    district: str | None = Query(default=None, max_length=100),
    village: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=200),
):
    """
    Return approved land records as a GeoJSON-ready FeatureCollection.

    Geometry remains null when authoritative geographic coordinates
    or parcel-boundary data are not available.
    """

    db = get_db()

    documents = (
        await db.documents.find({"status": "approved"})
        .sort("created_at", -1)
        .limit(200)
        .to_list(length=200)
    )

    features = []

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
        land_identifiers = extraction.get("land_identifiers") or {}
        land_details = extraction.get("land_details") or {}
        ownership = extraction.get("ownership_details") or {}

        searchable_values = [
            location.get("village"),
            location.get("tehsil"),
            location.get("district"),
            land_identifiers.get("survey_number"),
            land_identifiers.get("khasra_number"),
            land_identifiers.get("khata_number"),
            ownership.get("landowner_name"),
        ]

        if q:
            q_lower = q.strip().lower()

            if not any(
                q_lower in str(value).lower()
                for value in searchable_values
                if value is not None
            ):
                continue

        if district:
            if (
                str(location.get("district", "")).strip().lower()
                != district.strip().lower()
            ):
                continue

        if village:
            if (
                str(location.get("village", "")).strip().lower()
                != village.strip().lower()
            ):
                continue

        latitude = document.get("latitude")
        longitude = document.get("longitude")

        geometry = None

        if latitude is not None and longitude is not None:
            geometry = {
                "type": "Point",
                "coordinates": [
                    longitude,
                    latitude,
                ],
            }

        feature = {
            "type": "Feature",
            "id": document_id,
            "geometry": geometry,
            "properties": {
                "document_id": document_id,
                "location": {
                    "village": location.get("village"),
                    "tehsil": location.get("tehsil"),
                    "district": location.get("district"),
                },
                "land": {
                    "survey_number": land_identifiers.get(
                        "survey_number"
                    ),
                    "khasra_number": land_identifiers.get(
                        "khasra_number"
                    ),
                    "khata_number": land_identifiers.get(
                        "khata_number"
                    ),
                    "area": land_details.get("plot_area"),
                    "classification": land_details.get(
                        "land_classification"
                    ),
                },
                "owner": {
                    "name": ownership.get("landowner_name"),
                },
            },
        }

        features.append(feature)

        if len(features) >= limit:
            break

    return _serialize(
        {
            "type": "FeatureCollection",
            "features": features,
            "count": len(features),
            "map_ready": True,
        }
    )