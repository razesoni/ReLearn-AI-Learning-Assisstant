FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080 \
    HF_HOME=/tmp/huggingface

WORKDIR /app

# Install system dependencies (build-essential, curl, git if required for HuggingFace/Chroma)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency definition and install
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code and assets
COPY api/ /app/api/
COPY config/ /app/config/
COPY src/ /app/src/
COPY frontend/ /app/frontend/
COPY vector_store/ /app/vector_store/

# Expose standard Cloud Run port
EXPOSE 8080

# Run FastAPI app with Uvicorn bound to $PORT
CMD exec uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8080}
