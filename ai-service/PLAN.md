# SIH26018 — Land Record AI Microservice Analysis

This document provides a detailed analysis of the AI OCR pipeline project for extracting structured data from Indian land records (Khatauni / Jamabandi / RoR).

## 1. Project Overview
The project is a standalone FastAPI microservice designed to process scanned land record images and output structured, confidence-scored JSON. 
The core pipeline consists of:
`OpenCV Preprocessing -> PaddleOCR (Hindi + English) -> LLM Extraction Adapter -> Scored Schema`

It is designed to be stateless, holding no database credentials or PII at rest, acting purely as a processing engine for a main backend.

## 2. Architecture and Pipeline

The application processes incoming documents through a sequential pipeline:

1. **Pre-processing (`preprocessor.py`)**: Cleans and prepares the image for OCR.
2. **OCR Engine (`ocr_engine.py`)**: Extracts raw text and bounding boxes from the image using PaddleOCR.
3. **LLM Extraction (`extractor.py`)**: Prompts an LLM (Cloud or Local) to structure the unstructured OCR text into a strict JSON schema.
4. **API Layer (`main.py`)**: Exposes the pipeline via a FastAPI REST endpoint (`/process-document`).
5. **Backend Adapter (`ai_extraction_service.py`)**: A client-side translation layer intended to run on the main backend to interact with this microservice.

## 3. Detailed Component Analysis

### A. API Routing & Wiring (`main.py`)
- Built with **FastAPI**.
- Exposes three endpoints:
  - `GET /health`: Liveness and readiness probe. Indicates if OCR weights are loaded and ready.
  - `GET /v1/meta`: Returns system metadata (engines, supported languages, limits, current LLM mode).
  - `POST /process-document`: The main pipeline endpoint. Accepts `multipart/form-data` image uploads, orchestrates the preprocessing, OCR, and extraction stages, and returns a 200 OK with `status: "ok"` or `status: "needs_review"` depending on confidence scores.
- Implements defensive initialization via FastAPI's `lifespan` to warm up OCR weights and construct the extractor asynchronously.

### B. Image Preprocessing (`preprocessor.py`)
- Uses **OpenCV** to improve OCR accuracy, especially for faded or handwritten Devanagari text.
- **Steps**:
  - Image decoding and validation.
  - Downscaling large images (capping max edge, e.g., 2000px) to optimize performance.
  - Grayscale conversion and fast non-local means denoising (preserves Devanagari horizontal strokes/shirorekha).
  - Skew estimation and deskewing rotation (clamped to max degrees).
  - Contrast Limited Adaptive Histogram Equalization (CLAHE) for unevenly lit scans.
  - Adaptive Gaussian binarization.
  - Blur detection using the variance of the Laplacian.
- Outputs a `PreprocessResult` containing `ocr_input` (either CLAHE or binary depending on env config).

### C. Text Extraction (`ocr_engine.py`)
- Uses **PaddleOCR** initialized per language (Hindi and English separately).
- **Why Separate Engines?**: Running Devanagari and Latin models separately and merging results by bounding box Overlap (IoU) yields higher accuracy for bilingual records than running a single multi-language instance.
- Filters out low-confidence OCR lines (`OCR_MIN_LINE_CONF`).
- Sorts merged lines top-to-bottom and left-to-right.
- Provides a thread-safe singleton pattern (`get_engines()`) for lazy initialization.

### D. LLM Adapter & Schema (`extractor.py`)
- Implements the Adapter Pattern for LLMs (`LLMExtractor`), allowing easy swapping without modifying the core logic.
- **Supported Adapters**:
  - `CloudExtractor`: Calls Gemini or OpenAI via raw REST HTTP requests (`httpx`). Avoids bulky vendor SDKs.
  - `MockExtractor`: Uses RegEx for offline development and testing.
  - `LocalExtractor`: Built-in template for Ollama / vLLM / llama.cpp air-gapped models.
- **Prompt Engineering**: Instructs the LLM to strictly return JSON matching the schema, handle specific synonyms (e.g., Gram/Mauza -> village), and score its own extraction confidence.
- **Scoring Logic**: Combines the LLM's self-reported confidence with the OCR's mean confidence (damping factor) to prevent hallucinations from scoring highly on poor scans. 
- Flags fields (`flagged_fields`) if confidence falls below `FIELD_FLAG_THRESHOLD` (e.g., missing fields, unit ambiguity, illegible source).

### E. Backend Integration (`ai_extraction_service.py`)
- This file acts as a client wrapper meant for the orchestrating backend service.
- **`RealOcrAdapter`**: Sends the file to the microservice via HTTP POST, handles timeout/upstream errors, and translates the JSON payload into a list of `ExtractedField` dictionaries.
- Contains mapping dictionaries (`FIELD_SPECS`) to map the nested JSON paths (e.g., `location_details.village`) into flat field names (`village`) for database insertion/review UI.
- Adds semantic warnings (e.g., distinguishing between low OCR confidence vs LLM uncertainty).

## 4. Key Strengths & Design Decisions
1. **Decoupled LLMs**: Direct REST calls instead of SDKs reduce dependency hell.
2. **Business vs Transport Errors**: Low confidence extractions still return HTTP 200 with a `needs_review` flag, pushing business logic (routing to human verification) to the caller rather than triggering retry loops on bad documents.
3. **Resilience**: The pipeline handles large files, corrupted images, high skew, timeouts, and JSON parsing errors gracefully using custom Exception classes mapped to appropriate HTTP status codes.
4. **Performance tuning**: Separating English and Hindi OCR passes slightly impacts latency but drastically improves accuracy on mixed text. Downscaling ensures the pipeline doesn't choke on 12MP phone photos.
