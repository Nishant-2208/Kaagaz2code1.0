# Kaagaz2Code — SIH26018
## MongoDB + FastAPI Implementation Guide

> **Architecture decision:** MongoDB is the ONLY database service. Python FastAPI is the canonical backend API.
> PostgreSQL, Supabase database, SQLAlchemy and Alembic are intentionally removed from this build.

## 1. Final Architecture

React 19 + TypeScript
→ Python FastAPI (`:8000`)
→ MongoDB Atlas / self-hosted MongoDB

FastAPI
→ AI OCR FastAPI (`:8001`)
→ OpenCV + PaddleOCR + LLM
→ FastAPI
→ MongoDB

MongoDB is used for:
- users
- authentication/session metadata
- documents metadata
- document files through GridFS
- processing jobs
- land records
- extracted fields
- OCR jobs/results
- discrepancies
- append-only audit logs

## 2. Project Structure

```text
Kaagaz2Code-SIH2601A/
├── frontend/
├── fastapi_backend/
│   ├── app/
│   │   ├── api/v1/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── utils/
│   ├── tests/
│   ├── .env.example
│   ├── requirements.txt
│   └── Dockerfile
├── ai ocr pipeline/
├── IMPLEMENTATION.md
├── README.md
└── docker-compose.yml
```

## 3. MongoDB Setup

Recommended development option: MongoDB Atlas M0.

Create:
1. MongoDB Atlas project.
2. M0 cluster.
3. Database user with read/write access.
4. Network access for your development IP.
5. Connect → Drivers → Python.
6. Copy the URI into `fastapi_backend/.env`.

Example:
```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DATABASE=kaagaz2code
```

Do NOT commit `.env`.

### Collections

| Collection | Purpose |
|---|---|
| users | Google-authenticated application users |
| documents | Uploaded document metadata |
| processing_jobs | OCR/processing workflow |
| land_records | Verified structured land data |
| extracted_fields | Field-level extraction/confidence |
| discrepancies | Conflicts requiring review |
| audit_logs | Append-only audit trail |
| ocr_jobs | AI service processing state |
| ocr_results | OCR + LLM structured output |

### GridFS

Uploaded PDFs/images are stored using MongoDB GridFS under the `documents` bucket.

This avoids using Supabase Storage for the prototype.

## 4. Google OAuth

Create credentials in Google Cloud Console:
- OAuth Client ID
- Application type: Web application
- JavaScript origin: `http://localhost:5173`

Put:
```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Frontend receives the Google credential and sends it to:
```text
POST /api/v1/auth/google
```

FastAPI:
1. Verifies Google credential.
2. Reads email/name/Google subject.
3. Finds or creates the user in MongoDB.
4. Assigns/loads RBAC role.
5. Creates application JWT.
6. Returns access/refresh tokens.

Google credentials must never be stored in frontend source code except the public Client ID.

## 5. JWT + RBAC

Roles:
- citizen
- officer
- reviewer
- admin

JWT payload:
```json
{
  "sub": "mongodb-user-id",
  "role": "officer",
  "type": "access"
}
```

Use dependency-based authorization in FastAPI.

Example:
```text
require_auth()
require_role("officer")
require_role("reviewer")
require_role("admin")
```

## 6. Document Processing Flow

```text
Officer
  ↓
POST /documents/upload
  ↓
FastAPI validates file
  ↓
MongoDB GridFS
  ↓
documents collection
  ↓
processing_jobs collection
  ↓
AI OCR service :8001
  ↓
OpenCV preprocessing
  ↓
PaddleOCR
  ↓
LLM structured extraction
  ↓
confidence + flagged fields
  ↓
ocr_results
  ↓
validation
  ↓
NEEDS_REVIEW / VERIFIED
  ↓
Human review if necessary
  ↓
land_records
  ↓
Citizen lookup
```

## 7. AI Service Contract

`POST /process-document`

Response:
```json
{
  "status": "ok",
  "confidence": 0.87,
  "fields": {
    "survey_no": {
      "value": "123/A",
      "confidence": 0.92,
      "flagged": false
    }
  },
  "flagged_fields": [],
  "raw_text": "..."
}
```

FastAPI owns persistence. The AI service remains stateless.

## 8. Audit Logging

Every state-changing operation must append to `audit_logs`.

Never update/delete an audit entry.

Example:
```json
{
  "entity_type": "land_record",
  "entity_id": "...",
  "action": "APPROVED",
  "performed_by": "...",
  "timestamp": "...",
  "before": {},
  "after": {}
}
```

Audit logging must also happen on automatic approval.

## 9. Frontend Configuration

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_MOCKS=false
VITE_GOOGLE_CLIENT_ID=<client-id>
```

## 10. AI Configuration

Create `ai ocr pipeline/.env`:

```env
LLM_PROVIDER=cloud
GEMINI_API_KEY=<your-key>
OCR_MIN_LINE_CONF=0.6
FIELD_FLAG_THRESHOLD=0.75
MAX_IMAGE_EDGE=2000
AI_INTERNAL_API_KEY=<same-internal-key>
```

## 11. Running Locally

### MongoDB

Use MongoDB Atlas or local MongoDB.

### AI service

```bash
cd "ai ocr pipeline"
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### FastAPI backend

```bash
cd fastapi_backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux:
source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env   # Windows
# cp .env.example .env   # Linux

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:
```text
http://localhost:5173
```

API documentation:
```text
http://localhost:8000/docs
```

## 12. What You Must Configure

Before the first real end-to-end test, provide/configure:

- [ ] MongoDB Atlas connection URI
- [ ] MongoDB username/password
- [ ] Google OAuth Client ID
- [ ] Google OAuth Client Secret
- [ ] JWT secret
- [ ] JWT refresh secret
- [ ] LLM API key
- [ ] AI internal API key

Do not paste secrets into source files or Git.

## 13. Architecture Removed From Previous Build

The following are intentionally no longer used:

- PostgreSQL
- Supabase PostgreSQL
- Supabase Storage
- SQLAlchemy
- asyncpg
- Alembic
- Node.js Express backend as an API layer

The canonical request path is now:

```text
React → FastAPI → MongoDB
```

and:

```text
FastAPI → AI OCR FastAPI → FastAPI → MongoDB
```

## 14. Implementation Priority

1. MongoDB connection + indexes
2. Google OAuth + JWT
3. RBAC dependencies
4. GridFS upload
5. Processing jobs
6. AI service integration
7. OCR result persistence
8. Land-record validation
9. Review/approval workflow
10. Audit trail
11. Citizen lookup
12. Admin APIs
13. Replace remaining frontend mocks
14. End-to-end testing
15. Dockerized local deployment

## 15. Production Note

The SIH project target remains compatible with government/on-premise deployment requirements. MongoDB can be deployed in the approved government/empanelled infrastructure rather than relying on MongoDB Atlas for production.

MongoDB Atlas is being used only as a convenient development/testing option unless the deployment environment explicitly approves it.
