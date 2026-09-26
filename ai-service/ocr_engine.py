"""
ocr_engine.py — PaddleOCR initialisation and text extraction.

Two things worth knowing before you edit this file:

1. PaddleOCR takes ONE language per instance. `lang="hi,en"` is not valid. The
   Devanagari recogniser also covers Latin glyphs, but it is noticeably weaker on
   pure-English lines (registration numbers, "Hectare"), so we run one engine per
   configured language and merge by box overlap, keeping the higher-confidence
   read. Cost is ~1.6x latency for a solid accuracy gain on bilingual records.

2. Engine construction downloads ~20MB of weights and takes 5-15s. It is done
   once, lazily, behind a lock, and warmed at app startup so the first real
   request is not the one that pays for it.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

OCR_LANGS: list[str] = [s.strip() for s in os.getenv("OCR_LANGS", "hi,en").split(",") if s.strip()]
OCR_MIN_LINE_CONF: float = float(os.getenv("OCR_MIN_LINE_CONF", "0.35"))
OCR_USE_ANGLE_CLS: bool = os.getenv("OCR_USE_ANGLE_CLS", "true").lower() == "true"
_DEDUPE_IOU: float = 0.55

_engines: dict[str, Any] = {}
_lock = threading.Lock()


class OcrFailure(RuntimeError):
    """Raised when OCR completes but yields no usable text."""


class OcrEngineUnavailable(RuntimeError):
    """Raised when PaddleOCR itself cannot be constructed (missing weights, bad install)."""


@dataclass
class OcrLine:
    text: str
    confidence: float
    box: list[list[int]]  # 4 corner points, clockwise from top-left
    lang: str

    @property
    def top(self) -> int:
        return min(p[1] for p in self.box)

    @property
    def left(self) -> int:
        return min(p[0] for p in self.box)


@dataclass
class OcrResult:
    lines: list[OcrLine] = field(default_factory=list)
    full_text: str = ""
    mean_confidence: float = 0.0
    engine_ms: int = 0
    langs: list[str] = field(default_factory=list)


def _build_engine(lang: str) -> Any:
    """Construct a PaddleOCR instance for one language.

    Imported lazily so that `import ocr_engine` (and therefore the test suite and
    the /health endpoint) does not hard-depend on paddle being installed.
    """
    try:
        from paddleocr import PaddleOCR  # noqa: PLC0415 — intentional lazy import
    except ImportError as exc:  # pragma: no cover
        raise OcrEngineUnavailable(f"paddleocr is not installed: {exc}") from exc

    started = time.perf_counter()
    try:
        engine = PaddleOCR(
            lang=lang,
            use_angle_cls=OCR_USE_ANGLE_CLS,
            use_gpu=False,
            show_log=False,
            det_db_box_thresh=0.5,
            # Land records are dense multi-column forms; the default 1.5 merges
            # adjacent field labels and values into one unusable line.
            det_db_unclip_ratio=1.6,
        )
    except Exception as exc:  # pragma: no cover
        raise OcrEngineUnavailable(f"Failed to initialise PaddleOCR(lang={lang!r}): {exc}") from exc

    logger.info("PaddleOCR[%s] ready in %.1fs", lang, time.perf_counter() - started)
    return engine


def get_engines() -> dict[str, Any]:
    """Return the per-language engine map, building it on first call (thread-safe)."""
    if len(_engines) == len(OCR_LANGS):
        return _engines
    with _lock:
        for lang in OCR_LANGS:
            if lang not in _engines:
                _engines[lang] = _build_engine(lang)
    return _engines


def warmup() -> bool:
    """Build engines and run one tiny inference. Called from the FastAPI lifespan.

    Returns False instead of raising: a service that cannot OCR should still come
    up and answer /health honestly, so the orchestrator sees 503 not a crash loop.
    """
    try:
        engines = get_engines()
        blank = np.full((64, 256, 3), 255, dtype=np.uint8)
        for lang, engine in engines.items():
            engine.ocr(blank, cls=OCR_USE_ANGLE_CLS)
            logger.debug("Warmed engine %s", lang)
        return True
    except Exception as exc:
        logger.error("OCR warmup failed: %s", exc)
        return False


def is_ready() -> bool:
    return len(_engines) == len(OCR_LANGS) and len(_engines) > 0


def _bbox(box: list[list[int]]) -> tuple[int, int, int, int]:
    xs = [p[0] for p in box]
    ys = [p[1] for p in box]
    return min(xs), min(ys), max(xs), max(ys)


def _iou(a: list[list[int]], b: list[list[int]]) -> float:
    ax1, ay1, ax2, ay2 = _bbox(a)
    bx1, by1, bx2, by2 = _bbox(b)
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    if inter == 0:
        return 0.0
    union = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - inter
    return inter / union if union else 0.0


def _parse_raw(raw: Any, lang: str) -> list[OcrLine]:
    """Normalise PaddleOCR 2.7 output: [[ [box, (text, conf)], ... ]] (one entry per page)."""
    lines: list[OcrLine] = []
    if not raw:
        return lines
    page = raw[0] if isinstance(raw[0], list) or raw[0] is None else raw
    if not page:
        return lines
    for item in page:
        try:
            box, (text, conf) = item[0], item[1]
        except (IndexError, TypeError, ValueError):
            logger.debug("Skipping malformed OCR item: %r", item)
            continue
        text = (text or "").strip()
        if not text or float(conf) < OCR_MIN_LINE_CONF:
            continue
        lines.append(
            OcrLine(
                text=text,
                confidence=round(float(conf), 4),
                box=[[int(p[0]), int(p[1])] for p in box],
                lang=lang,
            )
        )
    return lines


def _merge(groups: list[list[OcrLine]]) -> list[OcrLine]:
    """Merge per-language results, dropping the weaker of any two overlapping boxes."""
    merged: list[OcrLine] = []
    for line in sorted((l for g in groups for l in g), key=lambda l: -l.confidence):
        if any(_iou(line.box, kept.box) > _DEDUPE_IOU for kept in merged):
            continue
        merged.append(line)
    # Reading order: top-to-bottom, then left-to-right within a ~15px band.
    merged.sort(key=lambda l: (l.top // 15, l.left))
    return merged


def extract_text(image: np.ndarray) -> OcrResult:
    """Run every configured engine over the preprocessed image and merge the output.

    Raises:
        OcrEngineUnavailable: engines could not be built.
        OcrFailure: engines ran but found no text above OCR_MIN_LINE_CONF.
    """
    engines = get_engines()
    started = time.perf_counter()
    groups: list[list[OcrLine]] = []

    for lang, engine in engines.items():
        try:
            raw = engine.ocr(image, cls=OCR_USE_ANGLE_CLS)
        except Exception as exc:
            # One language failing must not sink the request; the other may carry it.
            logger.error("OCR engine %s raised: %s", lang, exc)
            continue
        parsed = _parse_raw(raw, lang)
        logger.debug("Engine %s -> %d lines", lang, len(parsed))
        groups.append(parsed)

    lines = _merge(groups)
    elapsed_ms = int((time.perf_counter() - started) * 1000)

    if not lines:
        raise OcrFailure("No text regions detected above the confidence floor.")

    mean_conf = sum(l.confidence for l in lines) / len(lines)
    result = OcrResult(
        lines=lines,
        full_text="\n".join(l.text for l in lines),
        mean_confidence=round(mean_conf, 4),
        engine_ms=elapsed_ms,
        langs=list(engines.keys()),
    )
    logger.info("OCR: %d lines, mean_conf=%.3f, %dms", len(lines), mean_conf, elapsed_ms)
    return result
