# SIH26018 AI microservice — CPU image
# Build:  docker build -t sih26018-ai .
# Run:    docker run --rm -p 8001:8001 --env-file .env sih26018-ai
#
# 3.11 not 3.12: paddlepaddle 2.6.x wheels are most reliable on 3.10/3.11.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8001

# libgl1 + libglib2.0-0 are cv2's runtime deps; libgomp1 is paddle's OpenMP
# runtime. Omitting any of them produces an ImportError only at first request.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libgomp1 \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

# Bake the OCR weights into the image. Without this the container downloads
# ~40MB on first request — which in an air-gapped deployment means it never
# works at all, and on demo day means a 20s first response.
RUN python -c "\
from paddleocr import PaddleOCR; \
[PaddleOCR(lang=l, use_angle_cls=True, use_gpu=False, show_log=False) for l in ('hi','en')]" \
    || echo 'WARN: weight prefetch failed; will download at runtime'

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app /home/appuser
USER appuser

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD curl -fsS http://localhost:8001/health || exit 1

# Single worker on purpose: each worker loads its own copy of the OCR weights
# (~500MB RSS per language). Scale with replicas, not workers.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
