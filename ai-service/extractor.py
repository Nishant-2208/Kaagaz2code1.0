"""
extractor.py — schema definition + the LLM extraction adapter.

This module owns the output contract. main.py and the OCR layer know nothing
about which model produced the JSON.

Deliberate choice: no vendor SDKs. Cloud providers are called over plain
HTTP with httpx. This keeps the AI service lightweight and avoids vendor SDK
dependency churn next to paddlepaddle.

>>> TO ADD A LOCAL / AIR-GAPPED MODEL, see build_extractor() at the bottom. <<<
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from abc import ABC, abstractmethod
from typing import Any, Final

import httpx
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

SCHEMA_VERSION: Final[str] = "1.0.0"

LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "mock").lower()
LLM_MODEL: str = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")
LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "").rstrip("/")
LLM_TIMEOUT_S: float = float(os.getenv("LLM_TIMEOUT_S", "45"))
LLM_MAX_RETRIES: int = int(os.getenv("LLM_MAX_RETRIES", "1"))
CONFIDENCE_FLOOR: float = float(os.getenv("CONFIDENCE_FLOOR", "0.75"))
FIELD_FLAG_THRESHOLD: float = float(os.getenv("FIELD_FLAG_THRESHOLD", "0.70"))


# ============================================================================
# Exceptions — main.py maps these 1:1 onto HTTP status codes.
# ============================================================================
class ExtractorError(RuntimeError):
    """Base for all extraction failures."""


class LLMTimeoutError(ExtractorError):
    """Upstream model did not answer within LLM_TIMEOUT_S."""


class LLMUpstreamError(ExtractorError):
    """Upstream returned a non-2xx or unusable payload."""


class LLMResponseError(ExtractorError):
    """Model answered, but not with JSON matching our schema."""


class ExtractorConfigError(ExtractorError):
    """Provider is misconfigured (missing key, unknown provider)."""


# ============================================================================
# Output schema — the frozen contract.
# ============================================================================
class LocationDetails(BaseModel):
    village: str | None = None
    tehsil: str | None = None
    district: str | None = None


class LandIdentifiers(BaseModel):
    survey_number: str | None = None
    khasra_number: str | None = None
    khata_number: str | None = None


class LandDetails(BaseModel):
    plot_area: str | None = None
    land_classification: str | None = None


class OwnershipDetails(BaseModel):
    landowner_name: str | None = None
    registration_information: str | None = None
    mutation_records: str | None = None


class FlaggedField(BaseModel):
    field: str = Field(
        ...,
        description="Dotted path, e.g. land_identifiers.khata_number",
    )
    confidence: float
    reason: str = Field(
        ...,
        description=(
            "low_ocr_confidence|field_missing|unit_ambiguous|"
            "llm_uncertain|illegible"
        ),
    )


class ConfidenceScores(BaseModel):
    overall_confidence: float = 0.0
    flagged_fields: list[FlaggedField] = Field(default_factory=list)


class LandRecordExtraction(BaseModel):
    location_details: LocationDetails = Field(
        default_factory=LocationDetails
    )
    land_identifiers: LandIdentifiers = Field(
        default_factory=LandIdentifiers
    )
    land_details: LandDetails = Field(
        default_factory=LandDetails
    )
    ownership_details: OwnershipDetails = Field(
        default_factory=OwnershipDetails
    )
    confidence_scores: ConfidenceScores = Field(
        default_factory=ConfidenceScores
    )


# Every leaf we expect the model to attempt. Drives flagging and scoring.
FIELD_PATHS: Final[tuple[str, ...]] = (
    "location_details.village",
    "location_details.tehsil",
    "location_details.district",
    "land_identifiers.survey_number",
    "land_identifiers.khasra_number",
    "land_identifiers.khata_number",
    "land_details.plot_area",
    "land_details.land_classification",
    "ownership_details.landowner_name",
    "ownership_details.registration_information",
    "ownership_details.mutation_records",
)


# ============================================================================
# Prompt
# ============================================================================
SYSTEM_PROMPT: Final[str] = """You are a data-extraction engine for Indian land \
records (Record of Rights / Khatauni / Jamabandi / RoR), working from raw OCR text \
that may contain Hindi (Devanagari) and English, with OCR noise.

Return ONE JSON object and nothing else. No prose, no markdown, no code fences.

Exact shape:
{
  "location_details": {"village": null, "tehsil": null, "district": null},
  "land_identifiers": {"survey_number": null, "khasra_number": null, "khata_number": null},
  "land_details": {"plot_area": null, "land_classification": null},
  "ownership_details": {"landowner_name": null, "registration_information": null, "mutation_records": null},
  "field_confidence": {"location_details.village": 0.0},
  "illegible_fields": []
}

Rules:
1. Use null for any field not present or not readable. NEVER guess, never invent a
   plausible village or number. A null is correct; a hallucination is a data-integrity
   failure in a land-title system.
2. Transcribe values as they appear. Keep Devanagari in Devanagari. Do not translate
   names. Do not reformat numbers.
3. Common label synonyms:
   - village: gram / ग्राम / मौजा / mauza
   - tehsil: taluka / तहसील / circle
   - district: zila / जिला / जनपद
   - survey_number: sy. no. / सर्वे संख्या
   - khasra_number: खसरा / gat number / field number
   - khata_number: खाता / account no. / holding no.
   - plot_area: area / क्षेत्रफल / rakba / रकबा (keep the unit: hectare, acre, bigha, sq.m.)
   - land_classification: irrigated / sinchit / सिंचित / asinchit / barren / banjar /
     agricultural / non-agricultural / abadi
   - landowner_name: bhumidhar / भूमिधर / khatedar / owner / holder
   - registration_information: registration or deed number with date and SRO office
   - mutation_records: mutation / namantaran / नामांतरण / dakhil kharij entries
4. "field_confidence" must contain a 0.0-1.0 score for EVERY field path listed above,
   reflecting how certain you are the extracted value is correct given OCR noise.
   Use 0.0 for nulls.
5. "illegible_fields" lists field paths where a value clearly exists in the document
   but the OCR text is too garbled to transcribe with confidence.
6. If multiple owners or multiple mutation entries appear, join them with "; ".
"""

USER_TEMPLATE: Final[str] = """Document type: {doc_type}
OCR mean confidence: {ocr_conf:.3f}
Low-confidence OCR lines (transcribe with extra care): {weak_lines}

--- BEGIN OCR TEXT ---
{ocr_text}
--- END OCR TEXT ---

Return only the JSON object."""


def build_user_prompt(
    ocr_text: str,
    ocr_conf: float,
    weak_lines: list[str],
    doc_type: str,
) -> str:
    return USER_TEMPLATE.format(
        doc_type=doc_type,
        ocr_conf=ocr_conf,
        weak_lines=", ".join(
            f'"{w}"' for w in weak_lines[:10]
        ) or "none",
        ocr_text=ocr_text[:12000],
    )


_FENCE_RE = re.compile(
    r"^```(?:json)?\s*|\s*```$",
    re.MULTILINE,
)


def parse_model_json(text: str) -> dict[str, Any]:
    """Pull a JSON object out of a model response, tolerating fences and stray prose.

    Raises:
        LLMResponseError: nothing parseable in the response.
    """
    cleaned = _FENCE_RE.sub("", text).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    start, end = cleaned.find("{"), cleaned.rfind("}")

    if start != -1 and end > start:
        try:
            return json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError as exc:
            raise LLMResponseError(
                f"Model returned malformed JSON: {exc}"
            ) from exc

    raise LLMResponseError(
        "Model response contained no JSON object."
    )


# ============================================================================
# Scoring — deterministic, done here rather than trusted to the model.
# ============================================================================
def _get_path(data: dict[str, Any], path: str) -> Any:
    group, leaf = path.split(".")
    value = (data.get(group) or {}).get(leaf)

    return value if value not in ("", "null", "N/A") else None


def assemble(
    raw: dict[str, Any],
    ocr_mean_conf: float,
    image_illegible: bool,
) -> LandRecordExtraction:
    """Turn the model's raw dict into a validated LandRecordExtraction.

    Per-field confidence = LLM self-report, damped by OCR mean confidence.
    """
    field_conf: dict[str, Any] = raw.get("field_confidence") or {}
    illegible: set[str] = set(
        raw.get("illegible_fields") or []
    )

    damp = 0.5 + 0.5 * max(
        0.0,
        min(1.0, ocr_mean_conf),
    )

    flagged: list[FlaggedField] = []
    scores: list[float] = []

    for path in FIELD_PATHS:
        value = _get_path(raw, path)

        try:
            llm_conf = float(
                field_conf.get(path, 0.0)
            )
        except (TypeError, ValueError):
            llm_conf = 0.0

        llm_conf = max(
            0.0,
            min(1.0, llm_conf),
        )

        if path in illegible:
            flagged.append(
                FlaggedField(
                    field=path,
                    confidence=round(
                        llm_conf * damp,
                        3,
                    ),
                    reason="illegible",
                )
            )
            scores.append(0.0)
            continue

        if value is None:
            flagged.append(
                FlaggedField(
                    field=path,
                    confidence=0.0,
                    reason="field_missing",
                )
            )
            scores.append(0.0)
            continue

        score = round(
            llm_conf * damp,
            3,
        )

        scores.append(score)

        if score < FIELD_FLAG_THRESHOLD:
            reason = (
                "low_ocr_confidence"
                if ocr_mean_conf < 0.7
                else "llm_uncertain"
            )

            flagged.append(
                FlaggedField(
                    field=path,
                    confidence=score,
                    reason=reason,
                )
            )

        elif (
            path == "land_details.plot_area"
            and not re.search(
                r"(hect|ha\b|acre|bigha|biswa|sq|मी|हेक्ट|एकड़|बीघा)",
                str(value),
                re.IGNORECASE,
            )
        ):
            flagged.append(
                FlaggedField(
                    field=path,
                    confidence=score,
                    reason="unit_ambiguous",
                )
            )

    overall = (
        round(sum(scores) / len(scores), 3)
        if scores
        else 0.0
    )

    if image_illegible:
        overall = round(
            overall * 0.8,
            3,
        )

    payload = {
        "location_details": (
            raw.get("location_details") or {}
        ),
        "land_identifiers": (
            raw.get("land_identifiers") or {}
        ),
        "land_details": (
            raw.get("land_details") or {}
        ),
        "ownership_details": (
            raw.get("ownership_details") or {}
        ),
        "confidence_scores": {
            "overall_confidence": overall,
            "flagged_fields": [
                f.model_dump()
                for f in flagged
            ],
        },
    }

    return LandRecordExtraction.model_validate(
        payload
    )


# ============================================================================
# Adapter interface
# ============================================================================
class LLMExtractor(ABC):
    """Contract every extraction backend implements."""

    name: str = "base"
    mode: str = "unknown"

    @abstractmethod
    async def complete(
        self,
        system: str,
        user: str,
    ) -> str:
        """Send one prompt, return the raw text response."""

    async def extract(
        self,
        ocr_text: str,
        ocr_mean_conf: float,
        weak_lines: list[str] | None = None,
        doc_type: str = "land_record",
        image_illegible: bool = False,
    ) -> LandRecordExtraction:
        """Template method: prompt -> call -> score."""

        user = build_user_prompt(
            ocr_text,
            ocr_mean_conf,
            weak_lines or [],
            doc_type,
        )

        last: Exception | None = None

        for attempt in range(
            LLM_MAX_RETRIES + 1
        ):
            try:
                text = await self.complete(
                    SYSTEM_PROMPT,
                    user,
                )

                raw = parse_model_json(text)

                return assemble(
                    raw,
                    ocr_mean_conf,
                    image_illegible,
                )

            except LLMResponseError as exc:
                last = exc

                logger.warning(
                    "Attempt %d: unparseable response (%s)",
                    attempt + 1,
                    exc,
                )

                user += (
                    "\n\nYour previous reply was not valid JSON. "
                    "Reply with the JSON object only."
                )

            except LLMTimeoutError:
                raise

        raise LLMResponseError(
            f"Model never returned valid JSON: {last}"
        )


class CloudExtractor(LLMExtractor):
    """Gemini, OpenAI, or Groq over REST."""

    mode = "cloud"

    def __init__(
        self,
        provider: str,
        model: str,
        api_key: str,
        base_url: str = "",
    ) -> None:
        if not api_key:
            raise ExtractorConfigError(
                f"LLM_API_KEY is required for provider={provider!r}."
            )

        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.name = f"{provider}:{model}"

    async def complete(
        self,
        system: str,
        user: str,
    ) -> str:

        # ------------------------------------------------------------
        # Gemini REST API
        # ------------------------------------------------------------
        if self.provider == "gemini":
            url = (
                f"{self.base_url or 'https://generativelanguage.googleapis.com'}"
                f"/v1beta/models/{self.model}:generateContent"
            )

            headers = {
                "x-goog-api-key": self.api_key,
                "Content-Type": "application/json",
            }

            body: dict[str, Any] = {
                "systemInstruction": {
                    "parts": [
                        {
                            "text": system
                        }
                    ]
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {
                                "text": user
                            }
                        ],
                    }
                ],
                "generationConfig": {
                    "temperature": 0.0,
                    "responseMimeType": "application/json",
                    "maxOutputTokens": 2048,
                },
            }

        # ------------------------------------------------------------
        # OpenAI-compatible REST API
        # Used by both OpenAI and Groq.
        # ------------------------------------------------------------
        elif self.provider in ("openai", "groq"):

            if self.provider == "groq":
                default_base_url = "https://api.groq.com/openai"
            else:
                default_base_url = "https://api.openai.com"

            url = (
                f"{self.base_url or default_base_url}"
                "/v1/chat/completions"
            )

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }

            body = {
                "model": self.model,
                "temperature": 0.0,
                "response_format": {
                    "type": "json_object"
                },
                "messages": [
                    {
                        "role": "system",
                        "content": system,
                    },
                    {
                        "role": "user",
                        "content": user,
                    },
                ],
            }

        else:
            raise ExtractorConfigError(
                f"Unknown cloud provider: {self.provider!r}"
            )

        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(LLM_TIMEOUT_S)
            ) as client:

                resp = await client.post(
                    url,
                    headers=headers,
                    json=body,
                )

        except httpx.TimeoutException as exc:
            raise LLMTimeoutError(
                f"{self.name} timed out after "
                f"{LLM_TIMEOUT_S}s"
            ) from exc

        except httpx.HTTPError as exc:
            raise LLMUpstreamError(
                f"{self.name} transport error: {exc}"
            ) from exc

        if resp.status_code == 429:
            raise LLMUpstreamError(
                f"{self.name} rate limited (429)"
            )

        if resp.status_code >= 400:
            raise LLMUpstreamError(
                f"{self.name} returned "
                f"{resp.status_code}: "
                f"{resp.text[:300]}"
            )

        try:
            data = resp.json()
        except ValueError as exc:
            raise LLMUpstreamError(
                f"{self.name} returned invalid JSON."
            ) from exc

        try:
            if self.provider == "gemini":
                return data[
                    "candidates"
                ][0][
                    "content"
                ][
                    "parts"
                ][0]["text"]

            return data[
                "choices"
            ][0][
                "message"
            ][
                "content"
            ]

        except (
            KeyError,
            IndexError,
            TypeError,
        ) as exc:
            raise LLMUpstreamError(
                f"{self.name} sent an unexpected "
                f"response envelope: "
                f"{str(data)[:500]}"
            ) from exc


class MockExtractor(LLMExtractor):
    """Offline extractor: regex over OCR text. No network, no key.

    Purpose is not accuracy — it is that `LLM_PROVIDER=mock`
    lets the whole pipeline, test suite, and frontend run without
    API quota and provides an offline fallback.
    """

    name = "mock:regex"
    mode = "mock"

    @staticmethod
    def _normalize_text(text: str) -> str:
        """Deduplicate faux-bold repeating Devanagari syllables/clusters."""

        if not text:
            return ""

        cluster = (
            r"([\u0900-\u097f]"
            r"(?:[\u093c])?"
            r"(?:[\u094d][\u0900-\u097f](?:[\u093c])?)*"
            r"(?:[\u093e-\u094f\u0955-\u0957\u0962\u0963])?"
            r"(?:[\u0901-\u0903])?)"
        )

        return re.sub(
            rf"{cluster}\1+",
            r"\1",
            text,
        )

    _STOP: Final[str] = (
        r"(?=\s{2,}|\s*[\n,]|\s*$|\s*"
        r"(?:tehsil|taluka|तहसील|district|zila|जिला|"
        r"ज़िला|जनपद|khasra|खसरा|khata|खाता|survey|"
        r"सर्वे|village|gram|ग्राम|mauza|मौजा|गाँव|"
        r"गांव|area|क्षेत्रफल|rakba|रकबा|भूमि\s*उपयोग|"
        r"वार्षिक|लगान|owner|खातेदार|पिता|दाखिल|"
        r"mutation|नामांतरण|reg\b)(?:[\s:]|$|\b))"
    )

    _PATTERNS: Final[dict[str, str]] = {
        "location_details.village": (
            r"(?:village|gram|ग्राम|मौजा|मौजे|गाँव|"
            r"गांव|गावं)\s*[:\-]?\s*(.{2,40}?)"
            + _STOP
        ),
        "location_details.tehsil": (
            r"(?:tehsil|taluka|taluk|तहसील|तालुका|"
            r"सर्कल|अंचल)\s*[:\-]?\s*(.{2,40}?)"
            + _STOP
        ),
        "location_details.district": (
            r"(?:district|zila|जिला|ज़िला|जनपद|"
            r"ज़िलाला)\s*[:\-]?\s*(.{2,40}?)"
            + _STOP
        ),
        "land_identifiers.survey_number": (
            r"(?:survey\s*(?:no|number)?|सर्वे\s*"
            r"(?:संख्या|सं\.?|नं\.?|नंबर)?)\s*[:\-]?\s*"
            r"([0-9/\-A-Za-z]{1,20})"
        ),
        "land_identifiers.khasra_number": (
            r"(?:khasra|खसरा|gat|गाटा)\s*"
            r"(?:no|number|संख्या|सं\.?|नं\.?|नंबर)?"
            r"\s*[:\-]?\s*([0-9/\-A-Za-z]{1,20})"
        ),
        "land_identifiers.khata_number": (
            r"(?:khata|खाता|खेवट|खाते)\s*"
            r"(?:no|number|संख्या|सं\.?|नं\.?|नंबर)?"
            r"\s*[:\-]?\s*([0-9/\-A-Za-z]{1,20})"
        ),
        "land_details.plot_area": (
            r"(?:कुल\s*क्षेत्रफल|क्षेत्रफल|area|rakba|"
            r"रकबा|रकवा)\s*[:\-]?\s*"
            r"([0-9.,]+\s*(?:hectares?|ha\b|acres?|"
            r"bigha|biswa|sq\.?\s?m|हेक्टेयर|हेक्ट\S*|"
            r"एकड़|बीघा|बिस्वा)?)"
        ),
        "land_details.land_classification": (
            r"(?:भूमि\s*उपयोग\s*श्रेणी|उपयोग\s*श्रेणी|"
            r"श्रेणी|classification)?\s*[:\-]?\s*"
            r"(कृषि\s*भूमि\s*(?:\([^)]+\))?|सिंचित|"
            r"असिंचित|कृषि|irrigated|sinchit|asinchit|"
            r"barren|banjar|बंजर|agricultural|"
            r"non-agricultural|abadi|आबादी)"
        ),
        "ownership_details.landowner_name": (
            r"(?:खातेदार\s*(?:का\s*नाम)?|owner|bhumidhar|"
            r"khatedar|भूमिधर|काश्तकार|मालिक|नाम)"
            r"\s*[:\-]?\s*(.{2,60}?)"
            + _STOP
        ),
        "ownership_details.registration_information": (
            r"(?:reg(?:istration)?\.?\s*(?:no|number)?|"
            r"पंजीकरण|रजिस्ट्री|प्रमाणित|कार्यालय|दिनांक)"
            r"\s*[:\-]?\s*([^\n]{2,80})"
        ),
        "ownership_details.mutation_records": (
            r"(?:mutation|namantaran|नामांतरण|दाखिल\s*"
            r"खारिज(?:\s*क्रमांक)?|दाखिल\-खारिज)"
            r"\s*[:\-]?\s*([A-Za-z0-9/\-]{2,40}|"
            r"[^\n]{2,80})"
        ),
    }

    async def complete(
        self,
        system: str,
        user: str,
    ) -> str:
        raw_text = (
            user
            .split("--- BEGIN OCR TEXT ---")[-1]
            .split("--- END OCR TEXT ---")[0]
        )

        text = self._normalize_text(raw_text)

        out: dict[str, Any] = {
            "location_details": {},
            "land_identifiers": {},
            "land_details": {},
            "ownership_details": {},
            "field_confidence": {},
            "illegible_fields": [],
        }

        for path, pattern in self._PATTERNS.items():
            group, leaf = path.split(".")

            match = (
                re.search(
                    pattern,
                    text,
                    re.IGNORECASE,
                )
                or re.search(
                    pattern,
                    raw_text,
                    re.IGNORECASE,
                )
            )

            value = (
                match.group(1).strip()
                if match
                else None
            )

            out[group][leaf] = value
            out["field_confidence"][path] = (
                0.85 if value else 0.0
            )

        await asyncio.sleep(0)

        return json.dumps(
            out,
            ensure_ascii=False,
        )


# ---------------------------------------------------------------------------
# class LocalExtractor(LLMExtractor):
#     """Air-gapped backend. Ollama / vLLM / llama.cpp all expose an
#     OpenAI-shaped /v1/chat/completions.
#     """
#
#     mode = "local"
#
#     def __init__(self, model: str, base_url: str) -> None:
#         self.model = model
#         self.base_url = base_url or "http://localhost:11434"
#         self.name = f"local:{model}"
#
#     async def complete(self, system: str, user: str) -> str:
#         body = {
#             "model": self.model,
#             "stream": False,
#             "options": {
#                 "temperature": 0.0
#             },
#             "messages": [
#                 {
#                     "role": "system",
#                     "content": system
#                 },
#                 {
#                     "role": "user",
#                     "content": user
#                 }
#             ]
#         }
#
#         async with httpx.AsyncClient(
#             timeout=httpx.Timeout(LLM_TIMEOUT_S)
#         ) as client:
#             resp = await client.post(
#                 f"{self.base_url}/api/chat",
#                 json=body,
#             )
#
#         resp.raise_for_status()
#
#         return resp.json()["message"]["content"]
# ---------------------------------------------------------------------------


# ============================================================================
# >>> ADAPTER SWAP POINT <<<
# This factory is the ONLY place that knows which backend exists.
# ============================================================================
_cached: LLMExtractor | None = None


def build_extractor(
    provider: str | None = None,
) -> LLMExtractor:
    """Return the extractor for the configured provider."""

    global _cached

    provider = (
        provider or LLM_PROVIDER
    ).lower()

    if (
        _cached is not None
        and _cached.name.startswith(provider)
    ):
        return _cached

    if provider in (
        "gemini",
        "openai",
        "groq",
    ):
        _cached = CloudExtractor(
            provider,
            LLM_MODEL,
            LLM_API_KEY,
            LLM_BASE_URL,
        )

    elif provider == "mock":
        _cached = MockExtractor()

    else:
        raise ExtractorConfigError(
            f"Unsupported LLM_PROVIDER={provider!r}. "
            "Expected one of: gemini, openai, groq, mock."
        )

    logger.info(
        "Extractor ready: %s (mode=%s)",
        _cached.name,
        _cached.mode,
    )

    return _cached