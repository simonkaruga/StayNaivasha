from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/staynaivasha"
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET_KEY: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # M-Pesa — required in production, optional in dev
    MPESA_CONSUMER_KEY: str = ""
    MPESA_CONSUMER_SECRET: str = ""
    MPESA_SHORTCODE: str = ""
    MPESA_PASSKEY: str = ""
    MPESA_CALLBACK_URL: str = "https://staynaivasha.co.ke/api/payments/mpesa/callback"

    # Africa's Talking SMS + OTP
    AT_API_KEY: str = ""
    AT_USERNAME: str = "sandbox"

    # Third-party services
    CLAUDE_API_KEY: str = ""
    SENDGRID_API_KEY: str = ""
    FCM_SERVER_KEY: str = ""
    CLOUDINARY_URL: str = ""
    SENTRY_DSN: str = ""

    ALLOWED_ORIGINS: list[str] = [
        "https://staynaivasha.co.ke",
        "https://www.staynaivasha.co.ke",
        "https://staynaivasha.com",
        "http://localhost:5173",
    ]

    class Config:
        env_file = ".env"  # dev only — Railway uses env vars in production


settings = Settings()
