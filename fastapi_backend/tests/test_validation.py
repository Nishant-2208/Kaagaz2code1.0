import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timezone

from app.services.validation_service import validate_ai_extraction
from app.services.conflict_service import detect_conflicts
from app.services.normalization_service import normalize_string

class MockCursor:
    def __init__(self, items):
        self.items = items
        self._iter = iter(items)
    
    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration


@pytest.fixture
def mock_db():
    db = MagicMock()
    # By default, no existing jobs (no conflicts)
    db.processing_jobs.find = MagicMock(return_value=MockCursor([]))
    
    # Mock insert_many to return fake ids matching input length
    async def mock_insert_many(docs):
        res = MagicMock()
        res.inserted_ids = [f"fake_id_{i}" for i in range(len(docs))]
        return res
        
    db.discrepancies.insert_many = AsyncMock(side_effect=mock_insert_many)
    
    return db

@pytest.fixture
def mock_audit(mocker):
    return mocker.patch("app.services.validation_service.append_audit", new_callable=AsyncMock)

@pytest.mark.asyncio
async def test_normalization():
    # 5. same record with harmless formatting difference
    assert normalize_string("2.35 HECTARES ") == "2.35 हेक्टेयर"
    assert normalize_string("  SqM  ") == "वर्ग मीटर"
    assert normalize_string(" RamPur  ") == "rampur"
    assert normalize_string(None) == ""

@pytest.mark.asyncio
async def test_complete_valid_record(mock_db, mock_audit):
    # 1. complete valid record
    ai_result = {
        "status": "ok",
        "extraction": {
            "location_details": {"village": "Rampur", "district": "Lucknow"},
            "land_identifiers": {"khasra_number": "215/4"},
            "ownership_details": {"landowner_name": "Ramesh Kumar"}
        }
    }

    status = await validate_ai_extraction(mock_db, "doc1", "job1", ai_result, "user1")
    assert status == "verified"
    mock_db.discrepancies.insert_many.assert_not_called()

@pytest.mark.asyncio
async def test_missing_required_field(mock_db, mock_audit):
    # 2. missing required field
    ai_result = {
        "status": "ok",
        "extraction": {
            "location_details": {"district": "Lucknow"},  # Missing village
            "land_identifiers": {"khasra_number": "215/4"},
            "ownership_details": {"landowner_name": "Ramesh Kumar"}
        }
    }

    status = await validate_ai_extraction(mock_db, "doc1", "job1", ai_result, "user1")
    assert status == "needs_review"
    mock_db.discrepancies.insert_many.assert_called_once()
    args, kwargs = mock_db.discrepancies.insert_many.call_args
    discrepancies = args[0]
    assert len(discrepancies) == 1
    assert discrepancies[0]["field"] == "location_details.village"
    assert discrepancies[0]["discrepancy_type"] == "missing_field"

@pytest.mark.asyncio
async def test_invalid_identifier(mock_db, mock_audit):
    # 3. invalid identifier (none provided)
    ai_result = {
        "status": "ok",
        "extraction": {
            "location_details": {"village": "Rampur", "district": "Lucknow"},
            "land_identifiers": {},  # No khasra, khata, or survey
            "ownership_details": {"landowner_name": "Ramesh Kumar"}
        }
    }

    status = await validate_ai_extraction(mock_db, "doc1", "job1", ai_result, "user1")
    assert status == "needs_review"
    args, _ = mock_db.discrepancies.insert_many.call_args
    assert any(d["field"] == "land_identifiers" for d in args[0])

@pytest.mark.asyncio
async def test_duplicate_record(mock_db, mock_audit):
    # 4. duplicate record
    ai_result = {
        "status": "ok",
        "extraction": {
            "location_details": {"village": "Rampur", "district": "Lucknow"},
            "land_identifiers": {"khasra_number": "215/4"},
            "land_details": {"plot_area": "2.35 हेक्टेयर"},
            "ownership_details": {"landowner_name": "Ramesh Kumar"}
        }
    }
    
    # Mock finding an exact match
    existing_job = {
        "document_id": "old_doc",
        "result": {"extraction": ai_result["extraction"]}
    }
    mock_db.processing_jobs.find.return_value = MockCursor([existing_job])

    status = await validate_ai_extraction(mock_db, "doc1", "job1", ai_result, "user1")
    assert status == "needs_review"
    args, _ = mock_db.discrepancies.insert_many.call_args
    assert args[0][0]["discrepancy_type"] == "duplicate"

@pytest.mark.asyncio
async def test_conflicting_owner(mock_db, mock_audit):
    # 6. conflicting owner
    ai_result = {
        "status": "ok",
        "extraction": {
            "location_details": {"village": "Rampur", "district": "Lucknow"},
            "land_identifiers": {"khasra_number": "215/4"},
            "ownership_details": {"landowner_name": "Suresh Kumar"} # Different owner
        }
    }
    
    existing_job = {
        "document_id": "old_doc",
        "result": {
            "extraction": {
                "location_details": {"village": "Rampur", "district": "Lucknow"},
                "land_identifiers": {"khasra_number": "215/4"},
                "ownership_details": {"landowner_name": "Ramesh Kumar"}
            }
        }
    }
    mock_db.processing_jobs.find.return_value = MockCursor([existing_job])

    status = await validate_ai_extraction(mock_db, "doc1", "job1", ai_result, "user1")
    assert status == "needs_review"
    args, _ = mock_db.discrepancies.insert_many.call_args
    assert args[0][0]["discrepancy_type"] == "conflict"
    assert args[0][0]["field"] == "ownership_details.landowner_name"
    assert args[0][0]["ai_value"] == "Suresh Kumar"
    assert args[0][0]["expected_value"] == "Ramesh Kumar"

@pytest.mark.asyncio
async def test_conflicting_area(mock_db, mock_audit):
    # 7. conflicting area
    ai_result = {
        "status": "ok",
        "extraction": {
            "location_details": {"village": "Rampur", "district": "Lucknow"},
            "land_identifiers": {"khasra_number": "215/4"},
            "land_details": {"plot_area": "5.00 हेक्टेयर"},
            "ownership_details": {"landowner_name": "Ramesh Kumar"}
        }
    }
    
    existing_job = {
        "document_id": "old_doc",
        "result": {
            "extraction": {
                "location_details": {"village": "Rampur", "district": "Lucknow"},
                "land_identifiers": {"khasra_number": "215/4"},
                "land_details": {"plot_area": "2.35 हेक्टेयर"},
                "ownership_details": {"landowner_name": "Ramesh Kumar"}
            }
        }
    }
    mock_db.processing_jobs.find.return_value = MockCursor([existing_job])

    status = await validate_ai_extraction(mock_db, "doc1", "job1", ai_result, "user1")
    args, _ = mock_db.discrepancies.insert_many.call_args
    assert args[0][0]["field"] == "land_details.plot_area"

@pytest.mark.asyncio
async def test_insufficient_data_for_duplicate(mock_db, mock_audit):
    # 9. insufficient data for duplicate determination
    # Handled by missing village or identifiers -> caught by basic validation,
    # but let's test `detect_conflicts` directly.
    discrepancies = await detect_conflicts(mock_db, "doc1", {}, "user1")
    assert len(discrepancies) == 0

@pytest.mark.asyncio
async def test_multiple_discrepancies(mock_db, mock_audit):
    # 10. multiple discrepancies in one record
    ai_result = {
        "status": "ok",
        "extraction": {
            "location_details": {"district": "Lucknow"}, # Missing village
            "land_identifiers": {}, # Missing identifier
            "ownership_details": {"landowner_name": ""} # Missing owner
        }
    }
    status = await validate_ai_extraction(mock_db, "doc1", "job1", ai_result, "user1")
    assert status == "needs_review"
    args, _ = mock_db.discrepancies.insert_many.call_args
    assert len(args[0]) >= 3
