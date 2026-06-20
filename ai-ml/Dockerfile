# ── Runtime image ─────────────────────────────────────────────────────────────
# Python 3.12 matches the pinned wheels in requirements.txt (all prebuilt, so no
# compiler toolchain is needed — keeps the image small and the build fast).
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000 \
    HOST=0.0.0.0 \
    ENVIRONMENT=production \
    LOG_LEVEL=INFO

# Install dependencies first (better layer caching)
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Application source
COPY app/ ./app/

# Pre-trained artifacts (committed to the repo). The service only LOADS these —
# it never trains on the server. Run `python train.py` locally to regenerate.
COPY artifacts/ ./artifacts/

EXPOSE 8000

# Health check (uses the same /health endpoint Render polls)
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen(f\"http://localhost:{os.getenv('PORT','8000')}/health\")"

# Bind to Render's injected $PORT (falls back to 8000 locally). Shell form so
# the $PORT variable is expanded at runtime.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
