from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_database: str = "kaagaz2code"
    jwt_secret: str = "kaagaz2code-dev-jwt-secret-key-change-in-production-min-32-chars"
    jwt_refresh_secret: str = "kaagaz2code-dev-jwt-refresh-secret-key-change-in-production-min-32-chars"
    jwt_access_expiry_minutes: int = 15
    jwt_refresh_expiry_days: int = 7

    google_client_id: str = ""
    google_client_secret: str = ""

    ocr_service_url: str = "http://localhost:8001"
    ai_internal_api_key: str = ""

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]
    max_upload_mb: int = 15

    dev_login_enabled: bool = True
    frontend_login_url: str = "http://localhost:5173/login"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()