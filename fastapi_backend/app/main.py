from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.mongodb import connect_to_mongodb, close_mongodb

from app.api.v1 import (
    auth,
    documents,
    queue,
    records,
    discrepancies,
    audit,
    lookup,
    map,
    admin,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongodb()

    yield

    # Shutdown
    await close_mongodb()


app = FastAPI(
    title="Kaagaz2Code API",
    description="AI-powered land record digitisation and validation system",
    version="1.0.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------

app.state.limiter = limiter

app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler,
)


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Centralized error handling
# ---------------------------------------------------------------------------

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed.",
                "details": exc.errors(),
            },
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(
    request: Request,
    exc: Exception,
):
    # Temporary diagnostic logging.
    # This lets us see the real backend exception while
    # keeping the client response generic.
    print(
        f"UNHANDLED ERROR: {repr(exc)}",
        flush=True,
    )

    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected internal server error occurred.",
            },
        },
    )


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

app.include_router(
    auth.router,
    prefix="/api/v1/auth",
    tags=["Authentication"],
)

app.include_router(
    documents.router,
    prefix="/api/v1/documents",
    tags=["Documents"],
)

app.include_router(
    queue.router,
    prefix="/api/v1/queue",
    tags=["Processing Queue"],
)

app.include_router(
    records.router,
    prefix="/api/v1/records",
    tags=["Land Records"],
)

app.include_router(
    discrepancies.router,
    prefix="/api/v1/discrepancies",
    tags=["Discrepancies"],
)

app.include_router(
    audit.router,
    prefix="/api/v1/audit",
    tags=["Audit"],
)

app.include_router(
    lookup.router,
    prefix="/api/v1/lookup",
    tags=["Citizen Lookup"],
)

app.include_router(
    map.router,
    prefix="/api/v1/map",
    tags=["Map"],
)

app.include_router(
    admin.router,
    prefix="/api/v1/admin",
    tags=["Administration"],
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/api/v1/health", tags=["Health"])
async def health():
    return {
        "status": "ok",
        "service": "kaagaz2code-fastapi",
        "database": "mongodb",
    }