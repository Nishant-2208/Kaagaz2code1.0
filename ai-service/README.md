# SIH26018 — Land Record AI Microservice

Standalone FastAPI service: **document (PDF, DOCX, JPEG, PNG) in → structured, confidence-scored JSON out.**

`PDF / DOCX / Image parse & preprocess → PaddleOCR / Digital extract → LLM adapter → scored schema`

It holds no database credentials, no user sessions, and no PII at rest. The main
backend is its only intended caller.

---

## Requirements

- **Python 3.10 or 3.11.** `paddlepaddle` 2.6.x wheels are flakiest on 3.12 — if
  you must use 3.12 and the install fails, that is the first thing to change.
- ~2 GB disk (paddle + weights), ~1.2 GB RAM at runtime with both languages.
- No GPU needed.

On bare Debian/Ubuntu, OpenCV and Paddle need three system libs:

```bash
sudo apt-get install -y libgl1 libglib2.0-0 libgomp1
```

## Install & run

```bash
cd ai-service
python3.11 -m venv .venv && source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env                     # defaults to LLM_PROVIDER=mock — works offline

uvicorn main:app --port 8001
```

First boot downloads ~40 MB of OCR weights and takes 20–40 s. `/health` returns
`503 degraded` until warmup finishes, then `200 ok`.

### Point it at a real LLM

Edit `.env` — one line is the whole switch:

```bash
LLM_PROVIDER=gemini
LLM_MODEL=gemini-1.5-flash
LLM_API_KEY=AIza...
```

or

```bash
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=sk-...
```

No code changes, no restart of anything else in the stack.

## Docker

```bash
docker build -t sih26018-ai .
docker run --rm -p 8001:8001 --env-file .env sih26018-ai
```

The image pre-downloads the OCR weights at build time, so the container works
with **no egress** once `LLM_PROVIDER=local`.

---

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness + readiness. `200` ready, `503` warming or broken. |
| `GET` | `/v1/meta` | Versions, languages, limits, and `llm.mode` (`cloud` / `local` / `mock`). |
| `POST` | `/process-document` | The pipeline. `multipart/form-data`: `file` (required), `doc_type` (optional). |

Optional headers: `X-Request-Id` (echoed back, use it to correlate logs across
services) and `X-Internal-Key` (enforced only when `INTERNAL_API_KEY` is set).

### curl — health

```bash
curl -s localhost:8001/health | jq
```

```json
{ "service": "sih26018-ai-service", "status": "ok", "ocr_ready": true, "uptime_s": 42 }
```

### curl — process a document

```bash
curl -s -X POST localhost:8001/process-document \
  -H "X-Request-Id: demo-001" \
  -F "file=@samples/khatauni_01.jpg" \
  -F "doc_type=land_record" | jq
```

<details open>
<summary><strong>Expected 200 response</strong></summary>

```json
{
  "request_id": "demo-001",
  "status": "needs_review",
  "processing_ms": 9840,
  "engine": {
    "ocr": "paddleocr-2.7.3",
    "ocr_langs": ["hi", "en"],
    "llm": "gemini:gemini-1.5-flash",
    "mode": "cloud",
    "schema_version": "1.0.0"
  },
  "extraction": {
    "location_details": { "village": "रामपुर", "tehsil": "सदर", "district": "वाराणसी" },
    "land_identifiers": { "survey_number": "142/2", "khasra_number": "1187", "khata_number": null },
    "land_details": { "plot_area": "0.486 हेक्टेयर", "land_classification": "सिंचित" },
    "ownership_details": {
      "landowner_name": "राम प्रसाद यादव",
      "registration_information": "Reg. No. 4417, dated 12-03-1998, SRO Varanasi",
      "mutation_records": "नामांतरण 221/2011 दिनांक 04-07-2011"
    },
    "confidence_scores": {
      "overall_confidence": 0.712,
      "flagged_fields": [
        { "field": "land_identifiers.khata_number", "confidence": 0.0, "reason": "field_missing" },
        { "field": "ownership_details.mutation_records", "confidence": 0.61, "reason": "llm_uncertain" }
      ]
    }
  },
  "raw_ocr": {
    "text": "ग्राम: रामपुर\nतहसील: सदर\n…",
    "mean_ocr_confidence": 0.8412,
    "line_count": 27,
    "ocr_ms": 6120
  },
  "image_meta": {
    "width": 1654, "height": 2339,
    "skew_corrected_deg": -1.87, "blur_score": 214.6, "likely_illegible": false
  }
}
```
</details>

### Reading the response

- **`status: "ok"`** — `overall_confidence ≥ CONFIDENCE_FLOOR` *and* zero flagged
  fields. Safe to auto-file.
- **`status: "needs_review"`** — still `200`. Route to a human verifier and
  highlight `flagged_fields`.

Low confidence is a business outcome, not a transport error. If it were a 4xx,
every caller would have to re-implement the same branching, and a retry loop
would hammer the service over a document that will never improve.

`reason` values: `field_missing`, `low_ocr_confidence`, `llm_uncertain`,
`unit_ambiguous`, `illegible`.

### Errors

Every failure uses one envelope:

```json
{ "request_id": "demo-001",
  "error": { "code": "OCR_NO_TEXT", "message": "No readable text found…", "retryable": false } }
```

| Status | Code | Cause | Caller should |
|---|---|---|---|
| 400 | `IMAGE_DECODE_FAILED` | Corrupt bytes, or a PDF renamed `.jpg` | Ask user to re-upload |
| 401 | `UNAUTHORIZED` | Bad `X-Internal-Key` | Alert — never surface |
| 413 | `FILE_TOO_LARGE` | Over `MAX_FILE_MB` | Ask user to recompress |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Not an accepted image mime | Reject client-side first |
| 422 | `OCR_NO_TEXT` | Blank, inverted, or too low-res | Prompt a re-scan |
| 502 | `LLM_UPSTREAM_ERROR` / `LLM_INVALID_RESPONSE` | Provider 4xx/5xx, or non-JSON after retry | Retry once, then fail the job |
| 503 | `MODEL_LOADING` | OCR engine not built | Retry after 10 s |
| 504 | `LLM_TIMEOUT` | Over `LLM_TIMEOUT_S` | Retry with backoff |
| 500 | `PREPROCESSING_ERROR` / `OCR_ERROR` / `EXTRACTION_ERROR` | Unexpected | Log `request_id`, fail the job |

Reproduce two of them:

```bash
curl -s -X POST localhost:8001/process-document \
  -F "file=@deed.pdf;type=application/pdf" | jq          # 415

printf 'not-a-png' > /tmp/bad.png
curl -s -X POST localhost:8001/process-document \
  -F "file=@/tmp/bad.png;type=image/png" | jq            # 400
```

---

## Tests

```bash
pytest -v            # fast: no paddle, no network, no API key
pytest -v -m e2e     # real OCR on a synthetic record (slow)
```

The fast tier covers preprocessing (including a known 6° skew, verified to
recover to ±0.02°), JSON repair on fenced/prose-wrapped model output, confidence
damping and flagging, the adapter factory, and HTTP error mapping. It must stay
green on every commit.

---

## Adding a local / air-gapped model

`extractor.py` ends with a commented `LocalExtractor` and a factory marked
`>>> ADAPTER SWAP POINT <<<`. Three steps:

1. Uncomment `LocalExtractor` (it is ~15 lines — Ollama, vLLM, and llama.cpp all
   speak an OpenAI-shaped chat API).
2. Uncomment the `local` branch in `build_extractor()`.
3. Set `LLM_PROVIDER=local`, `LLM_MODEL=llama3:8b`, `LLM_BASE_URL=http://ollama:11434`.

Nothing in `main.py`, `ocr_engine.py`, or the response schema changes. That is
the point of the abstraction — the prototype→production security story is a
config change, not a rewrite.

---

## Tuning notes

| Symptom | Knob |
|---|---|
| Faded or handwritten scans read badly | `OCR_INPUT=clahe` (default). Try `binary` for clean typed records. |
| Adjacent form fields merged into one line | Lower `det_db_unclip_ratio` in `ocr_engine.py`. |
| Too slow | `OCR_LANGS=en` (halves latency), or lower `PREPROCESS_MAX_EDGE_PX`. |
| Too many `needs_review` | Raise `FIELD_FLAG_THRESHOLD` / lower `CONFIDENCE_FLOOR` — but understand you are trading data integrity for throughput. |
| Garbage lines in `raw_ocr.text` | Raise `OCR_MIN_LINE_CONF`. |

## Troubleshooting

- **`ImportError: libGL.so.1`** — install the three apt packages above.
- **`ModuleNotFoundError: paddle`** after a clean install — you are on Python
  3.12. Use 3.11.
- **Numpy ABI errors on first OCR call** — something upgraded numpy past 2.x.
  `pip install "numpy==1.26.4"`.
- **`.ocr() takes no argument 'cls'`** — paddleocr 3.x got installed. Pin 2.7.3.
- **Health stuck at 503** — read the startup logs; `warmup()` swallows the
  exception deliberately so the container stays debuggable instead of crash-looping.
- **Memory climbing with `--workers 4`** — each worker loads its own weights
  (~500 MB per language). Scale with replicas, not workers.
