from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.audit_service import append_audit
from app.services.conflict_service import detect_conflicts

async def validate_ai_extraction(db: AsyncIOMotorDatabase, document_id: str, job_id: str, ai_result: dict, user_id: str) -> str:
    """
    Validates AI extraction, checks conflicts, and creates discrepancies if needed.
    Returns the new document_status ('verified' or 'needs_review').
    """
    extraction = ai_result.get("extraction", {})
    location = extraction.get("location_details", {})
    identifiers = extraction.get("land_identifiers", {})
    ownership = extraction.get("ownership_details", {})

    discrepancies_to_create = []

    # 1. Missing Required Fields
    required_fields = {
        "location_details.village": location.get("village"),
        "location_details.district": location.get("district"),
        "ownership_details.landowner_name": ownership.get("landowner_name"),
    }

    for field_path, value in required_fields.items():
        if not value:
            discrepancies_to_create.append({
                "document_id": document_id,
                "field": field_path,
                "discrepancy_type": "missing_field",
                "description": f"Required field '{field_path}' is missing in extraction.",
                "ai_value": None,
                "expected_value": None,
                "severity": "high",
                "status": "open",
                "created_by": user_id,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            })

    # At least one identifier required
    khasra = identifiers.get("khasra_number")
    khata = identifiers.get("khata_number")
    survey = identifiers.get("survey_number")
    
    if not khasra and not khata and not survey:
        discrepancies_to_create.append({
            "document_id": document_id,
            "field": "land_identifiers",
            "discrepancy_type": "missing_field",
            "description": "At least one land identifier (khasra, khata, or survey) must be present.",
            "ai_value": None,
            "expected_value": None,
            "severity": "high",
            "status": "open",
            "created_by": user_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        })

    # 2. AI Confidence Flags
    confidence_scores = extraction.get("confidence_scores", {})
    for flagged in confidence_scores.get("flagged_fields", []):
        discrepancies_to_create.append({
            "document_id": document_id,
            "field": flagged.get("field"),
            "discrepancy_type": "low_confidence",
            "description": f"AI flagged field due to: {flagged.get('reason')}",
            "ai_value": None,
            "expected_value": None,
            "severity": "medium",
            "status": "open",
            "created_by": user_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        })

    # 3. Conflict / Duplicate Detection
    conflict_discrepancies = await detect_conflicts(db, document_id, extraction, user_id)
    discrepancies_to_create.extend(conflict_discrepancies)
    
    # 4. Insert Discrepancies and Audit
    if discrepancies_to_create:
        result = await db.discrepancies.insert_many(discrepancies_to_create)
        
        for i, doc_id in enumerate(result.inserted_ids):
            d = discrepancies_to_create[i]
            await append_audit(
                action="discrepancy_created",
                entity_type="discrepancy",
                entity_id=str(doc_id),
                performed_by=user_id,
                user_id=user_id,
                details={
                    "document_id": document_id,
                    "field": d["field"],
                    "discrepancy_type": d["discrepancy_type"],
                    "severity": d["severity"]
                }
            )

    # Determine status
    if discrepancies_to_create or ai_result.get("status") == "needs_review":
        return "needs_review"
        
    return "verified"
