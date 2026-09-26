from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.normalization_service import normalize_string

async def detect_conflicts(db: AsyncIOMotorDatabase, current_document_id: str, extraction: dict, user_id: str) -> list[dict]:
    """
    Detects duplicates or conflicts by querying existing completed processing jobs.
    Returns a list of discrepancy dicts to be inserted.
    """
    location = extraction.get("location_details", {})
    identifiers = extraction.get("land_identifiers", {})
    
    village = normalize_string(location.get("village", ""))
    district = normalize_string(location.get("district", ""))
    khasra = normalize_string(identifiers.get("khasra_number", ""))
    khata = normalize_string(identifiers.get("khata_number", ""))
    survey = normalize_string(identifiers.get("survey_number", ""))
    
    if not village or not district:
        return []
        
    if not khasra and not khata and not survey:
        return []
        
    discrepancies = []
    
    # Query other completed jobs in the same district
    query = {
        "document_id": {"$ne": current_document_id},
        "status": "completed",
        "result.extraction.location_details.district": location.get("district")
    }
    
    cursor = db.processing_jobs.find(query)
    
    async for existing_job in cursor:
        ex_ext = existing_job.get("result", {}).get("extraction", {})
        ex_loc = ex_ext.get("location_details", {})
        ex_id = ex_ext.get("land_identifiers", {})
        
        ex_village = normalize_string(ex_loc.get("village", ""))
        ex_khasra = normalize_string(ex_id.get("khasra_number", ""))
        ex_khata = normalize_string(ex_id.get("khata_number", ""))
        ex_survey = normalize_string(ex_id.get("survey_number", ""))
        
        if ex_village != village:
            continue
            
        match_khasra = khasra and ex_khasra == khasra
        match_khata = khata and ex_khata == khata
        match_survey = survey and ex_survey == survey
        
        # We define a record match if at least one land identifier matches exactly (along with district and village)
        if match_khasra or match_khata or match_survey:
            land = extraction.get("land_details", {})
            owner = extraction.get("ownership_details", {})
            
            ex_land = ex_ext.get("land_details", {})
            ex_owner = ex_ext.get("ownership_details", {})
            
            ex_owner_name = normalize_string(ex_owner.get("landowner_name", ""))
            curr_owner_name = normalize_string(owner.get("landowner_name", ""))
            
            ex_area = normalize_string(ex_land.get("plot_area", ""))
            curr_area = normalize_string(land.get("plot_area", ""))
            
            is_conflict = False
            
            if curr_owner_name and ex_owner_name and curr_owner_name != ex_owner_name:
                discrepancies.append(_build_discrepancy(
                    current_document_id, "ownership_details.landowner_name", "conflict",
                    "Ownership name differs from an existing record for this land.",
                    owner.get("landowner_name"), ex_owner.get("landowner_name"), user_id
                ))
                is_conflict = True
                
            if curr_area and ex_area and curr_area != ex_area:
                discrepancies.append(_build_discrepancy(
                    current_document_id, "land_details.plot_area", "conflict",
                    "Plot area differs from an existing record for this land.",
                    land.get("plot_area"), ex_land.get("plot_area"), user_id
                ))
                is_conflict = True
                
            if not is_conflict:
                # If everything matches, it's a duplicate submission
                discrepancies.append(_build_discrepancy(
                    current_document_id, "document", "duplicate",
                    "This document appears to be a duplicate or re-submission for an existing land record.",
                    None, None, user_id, severity="low"
                ))
                
    return discrepancies

def _build_discrepancy(doc_id, field, d_type, desc, ai_val, exp_val, user_id, severity="high"):
    return {
        "document_id": doc_id,
        "field": field,
        "discrepancy_type": d_type,
        "description": desc,
        "ai_value": ai_val,
        "expected_value": exp_val,
        "severity": severity,
        "status": "open",
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
