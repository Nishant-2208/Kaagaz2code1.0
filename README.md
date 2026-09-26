# Kaagaz2Code — SIH26018

AI-powered land-record digitisation and validation platform.

## Stack

- React 19 + TypeScript + Vite + Tailwind CSS
- Python FastAPI — canonical backend
- MongoDB — only database
- MongoDB GridFS — document file storage
- FastAPI AI service
- OpenCV
- PaddleOCR
- LLM-based structured extraction
- Google OAuth + JWT
- RBAC
- Docker

## Architecture

```text
React
  ↓
FastAPI
  ↓
MongoDB
  ↑
AI OCR FastAPI
```

See [`IMPLEMENTATION.md`](./IMPLEMENTATION.md) for complete setup and implementation instructions.

## Local services

| Service | Port |
|---|---:|
| Frontend | 5173 |
| FastAPI backend | 8000 |
| AI OCR | 8001 |
| MongoDB | Atlas/local |

## Important

MongoDB is the sole database service in this version. PostgreSQL/Supabase database dependencies and the Node.js API layer have been removed from the canonical architecture.
