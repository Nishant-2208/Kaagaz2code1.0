from datetime import datetime, timezone
from pathlib import PurePath
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    Request,
    status,
)
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.dependencies import require_role
from app.core.rate_limit import limiter
from app.db.mongodb import get_db, get_gridfs_bucket


router = APIRouter()


# Allowed scanned-document formats for the MVP.
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
}

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".tif",
    ".tiff",
}


# Actual file signatures / magic bytes.
FILE_SIGNATURES = {
    ".pdf": [
        b"%PDF-",
    ],
    ".jpg": [
        b"\xff\xd8\xff",
    ],
    ".jpeg": [
        b"\xff\xd8\xff",
    ],
    ".png": [
        b"\x89PNG\r\n\x1a\n",
    ],
    ".tif": [
        b"II*\x00",
        b"MM\x00*",
    ],
    ".tiff": [
        b"II*\x00",
        b"MM\x00*",
    ],
}


def get_extension(filename: str) -> str:
    """Return the lowercase file extension."""
    if "." not in filename:
        return ""

    return "." + filename.rsplit(".", 1)[1].lower()


def validate_file_signature(
    extension: str,
    file_data: bytes,
) -> bool:
    """Validate that the file contents match the claimed extension."""

    signatures = FILE_SIGNATURES.get(extension)

    if not signatures:
        return False

    return any(
        file_data.startswith(signature)
        for signature in signatures
    )


@router.post("/upload", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    current_user=Depends(require_role("officer", "admin")),
):
    """
    Upload a scanned land document.

    Flow:
    1. Authenticate officer/admin.
    2. Sanitize and validate filename.
    3. Validate extension and MIME type.
    4. Read the file.
    5. Enforce MAX_UPLOAD_MB.
    6. Validate the actual file signature.
    7. Store the original file in MongoDB GridFS.
    8. Create a document record.
    9. Create a processing job.
    10. Create an audit event.
    """

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is required.",
        )

    # Remove any directory/path components supplied by the client.
    filename = PurePath(file.filename.strip()).name

    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename.",
        )

    extension = get_extension(filename)

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Unsupported file type. Allowed formats: "
                "PDF, JPG, JPEG, PNG, TIF, TIFF."
            ),
        )

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported MIME type.",
        )

    max_size = settings.max_upload_mb * 1024 * 1024

    file_data = await file.read()

    if not file_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    if len(file_data) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"File exceeds the "
                f"{settings.max_upload_mb} MB limit."
            ),
        )

    # Verify the actual bytes instead of trusting only the
    # filename and client-provided MIME type.
    if not validate_file_signature(extension, file_data):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "File content does not match the "
                "declared file type."
            ),
        )

    db = get_db()
    bucket = get_gridfs_bucket()

    now = datetime.now(timezone.utc)
    document_id = str(uuid4())
    job_id = str(uuid4())

    # Store the original scanned document in MongoDB GridFS.
    gridfs_id = await bucket.upload_from_stream(
        filename,
        file_data,
        metadata={
            "document_id": document_id,
            "uploaded_by": str(current_user["_id"]),
            "content_type": file.content_type,
        },
    )

    # Store application-level document metadata.
    document = {
        "document_id": document_id,
        "filename": filename,
        "content_type": file.content_type,
        "size_bytes": len(file_data),
        "gridfs_id": gridfs_id,
        "uploaded_by": current_user["_id"],
        "status": "uploaded",
        "created_at": now,
        "updated_at": now,
    }

    await db.documents.insert_one(document)

    # Create the processing job that the OCR/AI pipeline will consume.
    processing_job = {
        "job_id": job_id,
        "document_id": document_id,
        "gridfs_id": gridfs_id,
        "status": "queued",
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["_id"],
    }

    await db.processing_jobs.insert_one(processing_job)

    # Audit event.
    await db.audit_logs.insert_one(
        {
            "entity_type": "document",
            "entity_id": document_id,
            "action": "uploaded",
            "performed_by": current_user["_id"],
            "timestamp": now,
            "metadata": {
                "filename": filename,
                "size_bytes": len(file_data),
                "content_type": file.content_type,
            },
        }
    )

    return {
        "status": "uploaded",
        "document_id": document_id,
        "job_id": job_id,
        "filename": filename,
        "size_bytes": len(file_data),
        "content_type": file.content_type,
        "processing_status": "queued",
    }


@router.get(
    "/{document_id}/download",
    response_class=StreamingResponse,
)
async def download_document(
    document_id: str,
    current_user=Depends(
        require_role(
            "officer",
            "reviewer",
            "admin",
        )
    ),
):
    """
    Stream an uploaded land document from MongoDB GridFS.

    Access is restricted to officer, reviewer, and admin roles.
    """

    db = get_db()
    bucket = get_gridfs_bucket()

    document = await db.documents.find_one(
        {"document_id": document_id}
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    gridfs_id = document.get("gridfs_id")

    if not gridfs_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file is not available.",
        )

    try:
        grid_out = await bucket.open_download_stream(
            gridfs_id
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file is not available.",
        )

    filename = document.get(
        "filename",
        "document",
    )

    content_type = document.get(
        "content_type",
        "application/octet-stream",
    )

    async def stream_file():
        while True:
            chunk = await grid_out.read(1024 * 1024)

            if not chunk:
                break

            yield chunk

    return StreamingResponse(
        stream_file(),
        media_type=content_type,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            ),
        },
    )
