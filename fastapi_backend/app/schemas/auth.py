from pydantic import BaseModel, EmailStr


# =========================================================
# DEVELOPMENT LOGIN
# =========================================================

class DevLoginRequest(BaseModel):
    name: str
    email: EmailStr
    role: str = "citizen"


# =========================================================
# GOOGLE REDIRECT LOGIN
# =========================================================

class GoogleLoginExchangeRequest(BaseModel):
    code: str


# =========================================================
# TOKEN RESPONSE
# =========================================================

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# =========================================================
# USER RESPONSE
# =========================================================

class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    provider: str
    is_active: bool