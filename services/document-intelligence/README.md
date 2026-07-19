# Document Intelligence Service

Python FastAPI service for future document processing and AI-heavy workflows.

## Slice 1 status

This scaffold provides:

- typed configuration
- structured JSON logging
- `/health/live` and `/health/ready`
- Pytest coverage for health/auth token checks

It does **not** perform OCR, extraction, or AI analysis yet.

## Local setup

```bash
cd services/document-intelligence
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn document_intelligence.main:app --reload --port 8000
```

## Tests

```bash
pytest
ruff check src tests
mypy src
```
