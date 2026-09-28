from datetime import (
    datetime,
    timedelta,
    timezone,
)
from secrets import token_urlsafe

from bson import ObjectId

from fastapi import (
    APIRouter,
    Depends,
    Form,
    HTTPException,
    Request,
    status,
)

from fastapi.responses import RedirectResponse

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.config import settings

from app.core.dependencies import (
    get_current_user,
    require_role,
)

from app.core.rate_limit import limiter

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)

from app.db.mongodb import get_db

from app.schemas.auth import (
    DevLoginRequest,
    GoogleLoginExchangeRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserResponse,
)


router = APIRouter()


# =========================================================
# FRONTEND
# =========================================================

FRONTEND_LOGIN_URL = (
    "http://localhost:5173/login"
)


# =========================================================
# DEVELOPMENT LOGIN
# =========================================================

@router.post(
    "/dev-login",
    response_model=TokenResponse,
)
@limiter.limit("5/minute")
async def dev_login(
    request: Request,
    data: DevLoginRequest,
):
    if not settings.dev_login_enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Development login is disabled",
        )

    db = get_db()

    allowed_roles = {
        "citizen",
        "officer",
        "reviewer",
        "admin",
    }

    if data.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role",
        )

    user = await db.users.find_one(
        {
            "email": data.email,
        }
    )

    now = datetime.now(
        timezone.utc
    )

    if user:

        await db.users.update_one(
            {
                "_id": user["_id"],
            },
            {
                "$set": {
                    "name": data.name,
                    "role": data.role,
                    "updated_at": now,
                }
            },
        )

        user_id = str(
            user["_id"]
        )

    else:

        # Development users intentionally do NOT receive
        # a google_id field. The google_id field is reserved
        # for accounts authenticated through Google OAuth.
        result = await db.users.insert_one(
            {
                "name": data.name,
                "email": data.email,
                "role": data.role,
                "provider": "development",
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
        )

        user_id = str(
            result.inserted_id
        )

    access_token = create_access_token(
        user_id,
        data.role,
    )

    refresh_token = create_refresh_token(
        user_id,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


# =========================================================
# GOOGLE REDIRECT LOGIN
# =========================================================

@router.post(
    "/google",
)
async def google_login(
    credential: str = Form(...),
    g_csrf_token: str = Form(...),
):
    db = get_db()

    if not settings.google_client_id:

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Google OAuth is not configured "
                "on the server"
            ),
        )

    # -----------------------------------------------------
    # Require Google CSRF field
    # -----------------------------------------------------

    if not g_csrf_token.strip():

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google CSRF token",
        )

    # -----------------------------------------------------
    # Verify Google ID token
    # -----------------------------------------------------

    try:

        idinfo = (
            id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                settings.google_client_id,
            )
        )

    except ValueError:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google ID token",
        )

    google_id = idinfo.get(
        "sub"
    )

    email = idinfo.get(
        "email"
    )

    name = idinfo.get(
        "name"
    )

    email_verified = idinfo.get(
        "email_verified",
        False,
    )

    # -----------------------------------------------------
    # Validate Google identity
    # -----------------------------------------------------

    if not google_id:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google account ID missing",
        )

    if not email:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account email missing",
        )

    if not email_verified:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google email is not verified",
        )

    now = datetime.now(
        timezone.utc
    )

    # -----------------------------------------------------
    # Find Google user
    # -----------------------------------------------------

    user = await db.users.find_one(
        {
            "google_id": google_id,
        }
    )

    # -----------------------------------------------------
    # Fallback to email
    # -----------------------------------------------------

    if not user:

        user = await db.users.find_one(
            {
                "email": email,
            }
        )

    # -----------------------------------------------------
    # Existing account
    # -----------------------------------------------------

    if user:

        if not user.get(
            "is_active",
            True,
        ):

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive",
            )

        role = user.get(
            "role",
            "citizen",
        )

        await db.users.update_one(
            {
                "_id": user["_id"],
            },
            {
                "$set": {
                    "name": (
                        name
                        or user.get(
                            "name",
                            "Google User",
                        )
                    ),
                    "email": email,
                    "google_id": google_id,
                    "provider": "google",
                    "updated_at": now,
                }
            },
        )

        user_id = str(
            user["_id"]
        )

    # -----------------------------------------------------
    # New account
    # -----------------------------------------------------

    else:

        result = await db.users.insert_one(
            {
                "name": (
                    name
                    or "Google User"
                ),
                "email": email,
                "role": "citizen",
                "provider": "google",
                "google_id": google_id,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
        )

        user_id = str(
            result.inserted_id
        )

        role = "citizen"

    # -----------------------------------------------------
    # Temporary one-time login code
    # -----------------------------------------------------

    exchange_code = token_urlsafe(
        48
    )

    expires_at = (
        now
        + timedelta(
            minutes=2
        )
    )

    await db.google_auth_codes.insert_one(
        {
            "code": exchange_code,

            # IMPORTANT:
            # Store MongoDB ObjectId, not string.
            "user_id": ObjectId(
                user_id
            ),

            "expires_at": expires_at,
            "used": False,
            "created_at": now,
        }
    )

    # -----------------------------------------------------
    # Redirect browser back to React
    # -----------------------------------------------------

    redirect_url = (
        f"{FRONTEND_LOGIN_URL}"
        f"?code={exchange_code}"
    )

    return RedirectResponse(
        url=redirect_url,
        status_code=status.HTTP_303_SEE_OTHER,
    )


# =========================================================
# GOOGLE CODE EXCHANGE
# =========================================================

@router.post(
    "/google/exchange",
    response_model=TokenResponse,
)
async def exchange_google_code(
    data: GoogleLoginExchangeRequest,
):
    db = get_db()

    now = datetime.now(
        timezone.utc
    )

    # -----------------------------------------------------
    # Find valid code
    # -----------------------------------------------------

    auth_code = (
        await db.google_auth_codes.find_one(
            {
                "code": data.code,
                "used": False,
                "expires_at": {
                    "$gt": now,
                },
            }
        )
    )

    if not auth_code:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Invalid, expired, or already "
                "used Google login code"
            ),
        )

    # -----------------------------------------------------
    # Atomically consume code
    # -----------------------------------------------------

    result = (
        await db.google_auth_codes.update_one(
            {
                "_id": auth_code["_id"],
                "used": False,
            },
            {
                "$set": {
                    "used": True,
                    "used_at": now,
                }
            },
        )
    )

    if result.modified_count != 1:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Google login code has already "
                "been used"
            ),
        )

    # -----------------------------------------------------
    # Get user
    # -----------------------------------------------------

    user = await db.users.find_one(
        {
            "_id": auth_code["user_id"],
        }
    )

    if not user:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Google user account not found"
            ),
        )

    if not user.get(
        "is_active",
        True,
    ):

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    user_id = str(
        user["_id"]
    )

    role = user.get(
        "role",
        "citizen",
    )

    # -----------------------------------------------------
    # Issue application JWT
    # -----------------------------------------------------

    access_token = create_access_token(
        user_id,
        role,
    )

    refresh_token = create_refresh_token(
        user_id,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


# =========================================================
# REFRESH ACCESS TOKEN
# =========================================================

@router.post(
    "/refresh",
    response_model=TokenResponse,
)
async def refresh_access_token(
    data: RefreshTokenRequest,
):
    db = get_db()

    try:
        payload = decode_refresh_token(
            data.refresh_token
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = payload.get("sub")

    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token subject",
        )

    user = await db.users.find_one(
        {"_id": ObjectId(user_id)}
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found",
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    role = user.get("role", "citizen")

    return TokenResponse(
        access_token=create_access_token(
            str(user["_id"]),
            role,
        ),
        refresh_token=create_refresh_token(
            str(user["_id"]),
        ),
    )


# =========================================================
# CURRENT USER
# =========================================================

@router.get(
    "/me",
    response_model=UserResponse,
)
async def get_me(
    current_user=Depends(
        get_current_user
    ),
):
    return UserResponse(
        id=str(
            current_user["_id"]
        ),
        name=current_user["name"],
        email=current_user["email"],
        role=current_user["role"],
        provider=current_user["provider"],
        is_active=current_user["is_active"],
    )


# =========================================================
# RBAC — CITIZEN
# =========================================================

@router.get(
    "/rbac/citizen-test"
)
async def citizen_test(
    current_user=Depends(
        require_role("citizen")
    ),
):
    return {
        "message":
            "Citizen access granted",

        "user_id":
            str(
                current_user["_id"]
            ),

        "role":
            current_user["role"],
    }


# =========================================================
# RBAC — OFFICER
# =========================================================

@router.get(
    "/rbac/officer-test"
)
async def officer_test(
    current_user=Depends(
        require_role(
            "officer",
            "admin",
        )
    ),
):
    return {
        "message":
            "Officer access granted",

        "user_id":
            str(
                current_user["_id"]
            ),

        "role":
            current_user["role"],
    }


# =========================================================
# RBAC — REVIEWER
# =========================================================

@router.get(
    "/rbac/reviewer-test"
)
async def reviewer_test(
    current_user=Depends(
        require_role(
            "reviewer",
            "admin",
        )
    ),
):
    return {
        "message":
            "Reviewer access granted",

        "user_id":
            str(
                current_user["_id"]
            ),

        "role":
            current_user["role"],
    }


# =========================================================
# RBAC — ADMIN
# =========================================================

@router.get(
    "/rbac/admin-test"
)
async def admin_test(
    current_user=Depends(
        require_role("admin")
    ),
):
    return {
        "message":
            "Admin access granted",

        "user_id":
            str(
                current_user["_id"]
            ),

        "role":
            current_user["role"],
    }