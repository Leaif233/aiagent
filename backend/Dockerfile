FROM python:3.11-slim

WORKDIR /app

# System deps for unstructured + sentence-transformers
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libmagic1 poppler-utils tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create data directories
RUN mkdir -p uploads/images chroma_data

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
