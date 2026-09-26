"""
test_pipeline.py — run with:  pytest -v

Two tiers:
  * Fast tests (default): no PaddleOCR, no network, no API key. They cover
    preprocessing, JSON repair, confidence scoring, the adapter, and HTTP error
    mapping. These must stay green on every commit.
  * End-to-end (`-m e2e`): renders a synthetic land record, runs the real OCR
    stack. Slow and needs paddle installed.

      pytest -v                  # fast only
      pytest -v -m e2e           # the real pipeline
"""

from __future__ import annotations

import os

# Must precede the extractor import: module-level config is read at import time.
os.environ.setdefault("LLM_PROVIDER", "mock")
os.environ.setdefault("INTERNAL_API_KEY", "")
os.environ.setdefault("LOG_LEVEL", "WARNING")

import cv2  # noqa: E402
import numpy as np  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import extractor as ex  # noqa: E402
import preprocessor  # noqa: E402
from main import app  # noqa: E402

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")

SAMPLE_LINES = [
    "RECORD OF RIGHTS",
    "Village: Rampur   Tehsil: Sadar",
    "District: Varanasi",
    "Khasra No: 1187   Khata No: 00214",
    "Survey No: 142/2",
    "Area: 0.486 hectare",
    "Classification: Irrigated",
    "Owner: Ram Prasad Yadav",
    "Reg No: 4417 dated 12-03-1998 SRO Varanasi",
    "Mutation: 221/2011 dated 04-07-2011",
]


def _render_record(skew_deg: float = 0.0) -> bytes:
    """Synthesise a clean English land record. Latin only — Devanagari needs a
    TTF that cv2.putText cannot render."""
    img = np.full((720, 1000, 3), 255, dtype=np.uint8)
    for i, line in enumerate(SAMPLE_LINES):
        cv2.putText(img, line, (40, 70 + i * 62), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 2, cv2.LINE_AA)
    if skew_deg:
        h, w = img.shape[:2]
        mat = cv2.getRotationMatrix2D((w / 2, h / 2), skew_deg, 1.0)
        img = cv2.warpAffine(img, mat, (w, h), borderValue=(255, 255, 255))
    return cv2.imencode(".png", img)[1].tobytes()


def _render_pdf_record() -> bytes:
    """Synthesise a test PDF containing land record lines."""
    try:
        import pymupdf as fitz
    except ImportError:
        import fitz  # type: ignore

    doc = fitz.open()
    page = doc.new_page()
    for i, line in enumerate(SAMPLE_LINES):
        page.insert_text((40, 70 + i * 35), line, fontsize=12)
    return doc.tobytes()


def _render_docx_record() -> bytes:
    """Synthesise a test DOCX containing land record lines."""
    import io
    import docx

    doc = docx.Document()
    for line in SAMPLE_LINES:
        doc.add_paragraph(line)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


@pytest.fixture(scope="module")
def client() -> TestClient:
    # The context manager triggers lifespan (OCR warmup). Without paddle it
    # fails gracefully and /health reports degraded — which is itself tested.
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------- preprocessing
def test_decode_rejects_empty_bytes() -> None:
    with pytest.raises(preprocessor.ImageDecodeError):
        preprocessor.decode_image(b"")


def test_decode_rejects_non_image() -> None:
    with pytest.raises(preprocessor.ImageDecodeError):
        preprocessor.decode_image(b"%PDF-1.4 this is not an image")


def test_preprocess_outputs_ocr_ready_image() -> None:
    result = preprocessor.preprocess(_render_record())
    assert result.ocr_input.ndim == 3 and result.ocr_input.shape[2] == 3, "PaddleOCR needs HxWx3"
    assert result.binary.ndim == 2
    assert set(np.unique(result.binary)).issubset({0, 255})
    assert result.blur_score > 0
    assert result.is_likely_illegible is False


def test_preprocess_corrects_skew() -> None:
    result = preprocessor.preprocess(_render_record(skew_deg=6.0))
    assert abs(result.skew_angle_deg) > 1.0, "a 6-degree skew should be detected"
    assert abs(result.skew_angle_deg) <= preprocessor.MAX_SKEW_DEG


def test_preprocess_downscales_large_images() -> None:
    big = cv2.imencode(".png", np.full((3000, 4000, 3), 255, np.uint8))[1].tobytes()
    result = preprocessor.preprocess(big)
    assert result.downscaled is True
    assert max(result.width, result.height) <= preprocessor.MAX_EDGE_PX


# ------------------------------------------------------------------- json repair
def test_parse_model_json_strips_code_fences() -> None:
    assert ex.parse_model_json('```json\n{"a": 1}\n```') == {"a": 1}


def test_parse_model_json_salvages_surrounding_prose() -> None:
    assert ex.parse_model_json('Sure! Here it is: {"a": 1} Hope that helps.') == {"a": 1}


def test_parse_model_json_raises_on_garbage() -> None:
    with pytest.raises(ex.LLMResponseError):
        ex.parse_model_json("I could not read the document.")


# -------------------------------------------------------------- confidence logic
def test_assemble_flags_every_missing_field() -> None:
    result = ex.assemble({}, ocr_mean_conf=0.9, image_illegible=False)
    flagged = result.confidence_scores.flagged_fields
    assert len(flagged) == len(ex.FIELD_PATHS)
    assert all(f.reason == "field_missing" for f in flagged)
    assert result.confidence_scores.overall_confidence == 0.0


def test_assemble_damps_confidence_by_ocr_quality() -> None:
    raw = {
        "location_details": {"village": "Rampur"},
        "field_confidence": {"location_details.village": 1.0},
    }
    clean = ex.assemble(raw, ocr_mean_conf=1.0, image_illegible=False)
    noisy = ex.assemble(raw, ocr_mean_conf=0.2, image_illegible=False)
    village = "location_details.village"
    clean_score = next(f.confidence for f in clean.confidence_scores.flagged_fields if f.field == village) \
        if any(f.field == village for f in clean.confidence_scores.flagged_fields) else 1.0
    noisy_score = next(f.confidence for f in noisy.confidence_scores.flagged_fields if f.field == village)
    assert noisy_score < clean_score, "a bad scan must not yield a confident field"


def test_assemble_flags_area_without_unit() -> None:
    raw = {
        "land_details": {"plot_area": "0.486"},  # no unit
        "field_confidence": {"land_details.plot_area": 0.98},
    }
    result = ex.assemble(raw, ocr_mean_conf=0.95, image_illegible=False)
    reasons = {f.field: f.reason for f in result.confidence_scores.flagged_fields}
    assert reasons["land_details.plot_area"] == "unit_ambiguous"


def test_assemble_accepts_area_with_unit() -> None:
    raw = {
        "land_details": {"plot_area": "0.486 hectare"},
        "field_confidence": {"land_details.plot_area": 0.98},
    }
    result = ex.assemble(raw, ocr_mean_conf=0.95, image_illegible=False)
    reasons = {f.field: f.reason for f in result.confidence_scores.flagged_fields}
    assert "land_details.plot_area" not in reasons


# ------------------------------------------------------------------- the adapter
def test_factory_returns_mock_and_rejects_unknown() -> None:
    assert ex.build_extractor("mock").mode == "mock"
    with pytest.raises(ex.ExtractorConfigError):
        ex.build_extractor("wolfram-alpha")


def test_cloud_extractor_requires_api_key() -> None:
    with pytest.raises(ex.ExtractorConfigError):
        ex.CloudExtractor("gemini", "gemini-1.5-flash", api_key="")


@pytest.mark.anyio
async def test_mock_extractor_pulls_fields_from_ocr_text() -> None:
    result = await ex.MockExtractor().extract(
        ocr_text="\n".join(SAMPLE_LINES), ocr_mean_conf=0.93, doc_type="land_record"
    )
    assert result.location_details.village == "Rampur", "capture must stop at the next label"
    assert result.location_details.tehsil == "Sadar"
    assert result.land_identifiers.khasra_number == "1187"
    assert "hectare" in result.land_details.plot_area
    assert result.confidence_scores.overall_confidence > 0.5


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


# ----------------------------------------------------------------- http surface
def test_health_always_answers(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.status_code in (200, 503)  # 503 == paddle absent, still a valid answer
    assert resp.json()["service"] == "sih26018-ai-service"


def test_meta_exposes_mode_badge(client: TestClient) -> None:
    body = client.get("/v1/meta").json()
    assert body["llm"]["mode"] == "mock"
    assert body["schema_version"] == ex.SCHEMA_VERSION
    assert body["ocr"]["langs"] == ["hi", "en"]


def test_rejects_unsupported_mime(client: TestClient) -> None:
    resp = client.post(
        "/process-document",
        files={"file": ("track.mp3", b"ID3\x03fake-audio", "audio/mpeg")},
    )
    assert resp.status_code == 415
    assert resp.json()["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"


def test_process_docx_document(client: TestClient) -> None:
    docx_bytes = _render_docx_record()
    resp = client.post(
        "/process-document",
        files={"file": ("record.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"doc_type": "land_record"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in ("ok", "needs_review")
    assert "rampur" in body["raw_ocr"]["text"].lower()
    assert body["extraction"]["location_details"]["village"] == "Rampur"


def test_process_pdf_document_with_text(client: TestClient) -> None:
    pdf_bytes = _render_pdf_record()
    resp = client.post(
        "/process-document",
        files={"file": ("record.pdf", pdf_bytes, "application/pdf")},
        data={"doc_type": "land_record"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in ("ok", "needs_review")
    assert "rampur" in body["raw_ocr"]["text"].lower()
    assert body["extraction"]["location_details"]["village"] == "Rampur"


@pytest.mark.anyio
async def test_hindi_khatauni_extraction() -> None:
    sample_text = (
        "राजस्व एवं भूमि सुधार विभाग\n"
        "अधिकार अभिलेख (खतौनी / खसरा उद्धरण)\n"
        "ज़िला: लखनऊ   तहसील: सदर   गाँव: रामपुर\n"
        "खातेदार का नाम: रमेश कुमार\n"
        "पिता का नाम: सुरेश कुमार\n"
        "खाता संख्या: 408\n"
        "खसरा संख्या: 215/4\n"
        "कुल क्षेत्रफल: 2.35 हेक्टेयर\n"
        "भूमि उपयोग श्रेणी: कृषि भूमि (सिंचित)\n"
        "वार्षिक लगान: ₹ 65.00\n"
        "दाखिल खारिज क्रमांक: MUT-2026-9041\n"
        "कार्यालय: तहसीलदार, सदर\n"
        "दिनांक: 26-08-2026"
    )
    result = await ex.MockExtractor().extract(ocr_text=sample_text, ocr_mean_conf=0.95, doc_type="land_record")
    assert result.location_details.district == "लखनऊ"
    assert result.location_details.tehsil == "सदर"
    assert result.location_details.village == "रामपुर"
    assert result.land_identifiers.khata_number == "408"
    assert result.land_identifiers.khasra_number == "215/4"
    assert "2.35" in str(result.land_details.plot_area)
    assert "हेक्टेयर" in str(result.land_details.plot_area)
    assert "कृषि" in str(result.land_details.land_classification)
    assert "रमेश कुमार" in str(result.ownership_details.landowner_name)
    assert "MUT-2026-9041" in str(result.ownership_details.mutation_records)
    # Ensure no unit_ambiguous flag
    flagged = {f.field: f.reason for f in result.confidence_scores.flagged_fields}
    assert "land_details.plot_area" not in flagged


@pytest.mark.anyio
async def test_hindi_khatauni_duplicated_text_extraction() -> None:
    # Exact text produced by PDF faux-bold glyph duplication in user's sample
    duplicated_text = (
        "राराजस्व एवंवं भूभूमिमि सुसुधाधार विविभाभाग\n"
        "अधिधिकाकार अभिभिलेलेख (खतौतौनीनी / खसरारा उद्धरण)\n"
        "ज़िज़िलाला: लखनऊ तहसीसील: सदर गाँगाँगाँव: रारामपुपुर\n"
        "खाखातेतेदादार काका नानाम: रमेमेश कुकु मामार\n"
        "पिपिताता काका नानाम: सुसुरेरेश कुकु मामार\n"
        "खाखाताता संसंख्याख्या: 408\n"
        "खसरारा संसंख्याख्या: 215/4\n"
        "कुकु ल क्षेक्षेत्रफल: 2.35 हेहेक्टेक्टेयर\n"
        "भूभूमिमि उपयोयोग श्रेश्रेणीणी: कृकृ षिषि भूभूमिमि (सिंसिंसिंचिचित)\n"
        "दादाखिखिल खाखारिरिज क्रमांमांमांक: MUT-2026-9041"
    )
    result = await ex.MockExtractor().extract(ocr_text=duplicated_text, ocr_mean_conf=0.95, doc_type="land_record")
    assert result.location_details.district == "लखनऊ"
    assert result.location_details.tehsil == "सदर"
    assert "रामपुर" in str(result.location_details.village)
    assert result.land_identifiers.khata_number == "408"
    assert result.land_identifiers.khasra_number == "215/4"
    assert "2.35" in str(result.land_details.plot_area)
    assert "हेक्टेयर" in str(result.land_details.plot_area)
    assert any(c in str(result.land_details.land_classification) for c in ("सिंचित", "कृषि"))
    assert "रमेश" in str(result.ownership_details.landowner_name)
    assert "MUT-2026-9041" in str(result.ownership_details.mutation_records)


def test_rejects_corrupt_image(client: TestClient) -> None:
    resp = client.post(
        "/process-document",
        files={"file": ("scan.png", b"not-really-a-png", "image/png")},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "IMAGE_DECODE_FAILED"


def test_request_id_is_echoed(client: TestClient) -> None:
    resp = client.get("/health", headers={"X-Request-Id": "trace-me-123"})
    assert resp.headers["X-Request-Id"] == "trace-me-123"


# ------------------------------------------------------------------------- e2e
@pytest.mark.e2e
def test_end_to_end_pipeline(client: TestClient) -> None:
    """Real preprocessing + real PaddleOCR + mock extractor. Needs paddle installed."""
    pytest.importorskip("paddleocr")
    resp = client.post(
        "/process-document",
        files={"file": ("record.png", _render_record(skew_deg=2.0), "image/png")},
        data={"doc_type": "land_record"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["status"] in ("ok", "needs_review")
    assert body["engine"]["mode"] == "mock"

    extraction = body["extraction"]
    assert set(extraction) == {
        "location_details", "land_identifiers", "land_details",
        "ownership_details", "confidence_scores",
    }
    assert set(extraction["land_identifiers"]) == {"survey_number", "khasra_number", "khata_number"}
    assert isinstance(extraction["confidence_scores"]["flagged_fields"], list)
    assert 0.0 <= extraction["confidence_scores"]["overall_confidence"] <= 1.0

    assert body["raw_ocr"]["line_count"] > 3
    assert "rampur" in body["raw_ocr"]["text"].lower()
