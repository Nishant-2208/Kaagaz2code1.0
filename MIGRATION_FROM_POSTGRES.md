# Migration Note

This build supersedes the earlier PostgreSQL/Supabase database architecture.

## Replaced
- PostgreSQL → MongoDB
- Supabase Storage → MongoDB GridFS
- SQLAlchemy/Alembic → Motor/MongoDB indexes
- Node/Express API → FastAPI canonical API

## Data model
The application is now document-oriented. Collection schemas and indexes are defined in `fastapi_backend/app/models/` and `fastapi_backend/app/db/mongodb.py`.

Existing prototype data is not automatically migrated by this package. If you have real prototype data that must be retained, export it first and map it into the MongoDB collections deliberately.
