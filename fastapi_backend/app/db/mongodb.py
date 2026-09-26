from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorDatabase,
)
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

from app.core.config import settings


client: AsyncIOMotorClient | None = None
database: AsyncIOMotorDatabase | None = None
gridfs_bucket: AsyncIOMotorGridFSBucket | None = None


# =========================================================
# CONNECT
# =========================================================

async def connect_to_mongodb() -> None:
    global client, database, gridfs_bucket

    print("Connecting to MongoDB...")

    client = AsyncIOMotorClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=5000,
    )

    await client.admin.command("ping")

    database = client[
        settings.mongodb_database
    ]

    # MongoDB GridFS bucket for scanned land documents.
    gridfs_bucket = AsyncIOMotorGridFSBucket(
        database,
        bucket_name="documents",
    )

    print(
        "MongoDB connected successfully: "
        f"{settings.mongodb_database}"
    )

    await create_indexes()


# =========================================================
# CLOSE
# =========================================================

async def close_mongodb() -> None:
    global client, database, gridfs_bucket

    if client is not None:
        client.close()

        client = None
        database = None
        gridfs_bucket = None

    print("MongoDB connection closed.")


# =========================================================
# GET DATABASE
# =========================================================

def get_db() -> AsyncIOMotorDatabase:
    if database is None:
        raise RuntimeError(
            "MongoDB is not connected."
        )

    return database


# =========================================================
# GET GRIDFS BUCKET
# =========================================================

def get_gridfs_bucket() -> AsyncIOMotorGridFSBucket:
    if gridfs_bucket is None:
        raise RuntimeError(
            "MongoDB GridFS is not connected."
        )

    return gridfs_bucket


# =========================================================
# INDEXES
# =========================================================

async def create_indexes() -> None:
    db = get_db()

    # -----------------------------------------------------
    # Users
    # -----------------------------------------------------

    await db.users.create_index(
        "email",
        unique=True,
        name="unique_user_email",
    )

    await db.users.create_index(
        "google_id",
        unique=True,
        sparse=True,
        name="unique_user_google_id",
    )

    # -----------------------------------------------------
    # Documents
    # -----------------------------------------------------

    await db.documents.create_index(
        "uploaded_by",
        name="documents_uploaded_by",
    )

    await db.documents.create_index(
        "status",
        name="documents_status",
    )

    # -----------------------------------------------------
    # Processing jobs
    # -----------------------------------------------------

    await db.processing_jobs.create_index(
        "job_id",
        unique=True,
        name="unique_processing_job_id",
    )

    await db.processing_jobs.create_index(
        "status",
        name="processing_jobs_status",
    )

    # -----------------------------------------------------
    # Land records
    # -----------------------------------------------------

    await db.land_records.create_index(
        "survey_no",
        name="land_records_survey_no",
    )

    await db.land_records.create_index(
        [
            ("village", 1),
            ("district", 1),
        ],
        name="land_records_location",
    )

    # -----------------------------------------------------
    # Audit logs
    # -----------------------------------------------------

    await db.audit_logs.create_index(
        [
            ("entity_type", 1),
            ("entity_id", 1),
        ],
        name="audit_entity",
    )

    await db.audit_logs.create_index(
        "timestamp",
        name="audit_timestamp",
    )

    # -----------------------------------------------------
    # Temporary Google authentication codes
    # -----------------------------------------------------

    await db.google_auth_codes.create_index(
        "code",
        unique=True,
        name="unique_google_auth_code",
    )

    await db.google_auth_codes.create_index(
        "expires_at",
        expireAfterSeconds=0,
        name="google_auth_code_ttl",
    )

    print(
        "MongoDB indexes initialized."
    )