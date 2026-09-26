# SIH26018 — Pipeline Backlog & Future Features

## 📄 PDF Support
**Requested:** 2026-09-19  
**Priority:** Medium  
**Status:** Not started

### What needs to change
The current pipeline only accepts images (`image/jpeg`, `image/png`, `image/tiff`, `image/bmp`, `image/webp`).
PDF support requires:

1. **`main.py`** — Add `application/pdf` to `ACCEPTED_MIME`
2. **`preprocessor.py`** — Add a PDF-to-image conversion step before the existing pipeline:
   - Use `PyMuPDF` (`fitz`) — **already installed** in `requirements.txt` as a dependency of `paddleocr`
   - Render each page as a PNG at 200–300 DPI, then run the existing preprocess chain per page
3. **`main.py`** — Handle multi-page PDFs: run OCR on each page, merge results, aggregate confidence scores
4. **`ocr_engine.py`** — No changes needed — it already takes a `np.ndarray`

### Sketch (preprocessor.py addition)
```python
def pdf_to_images(raw: bytes) -> list[np.ndarray]:
    import fitz  # PyMuPDF — already in requirements
    doc = fitz.open(stream=raw, filetype="pdf")
    images = []
    for page in doc:
        mat = fitz.Matrix(2.0, 2.0)  # 2x zoom = ~144 DPI
        pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
        img_bytes = pix.tobytes("png")
        buf = np.frombuffer(img_bytes, dtype=np.uint8)
        images.append(cv2.imdecode(buf, cv2.IMREAD_COLOR))
    return images
```

### Notes
- `PyMuPDF` is **already available** in the Docker image (installed as a `paddleocr` dependency) — no new packages needed
- Multi-page PDFs (e.g. a 4-page Jamabandi) should process all pages and return a merged extraction
- The 15MB file size limit in `.env` (`MAX_FILE_MB=15`) should be sufficient for most land record PDFs

---

> Add more backlog items below as they come up.
