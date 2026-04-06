from functools import lru_cache
from typing import Optional

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    project_name: str = Field(default="wifi-portal", alias="PROJECT_NAME")
    postgres_db: str = Field(alias="POSTGRES_DB")
    postgres_user: str = Field(alias="POSTGRES_USER")
    postgres_password: str = Field(alias="POSTGRES_PASSWORD")
    postgres_host: str = Field(default="postgres", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")
    database_url_raw: Optional[str] = Field(default=None, alias="DATABASE_URL")
    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 480
    app_encryption_key: str = Field(alias="APP_ENCRYPTION_KEY")
    cors_allowed_origins_raw: str = Field(default="http://localhost:3000", alias="CORS_ALLOWED_ORIGINS")
    admin_username: str = Field(alias="ADMIN_USERNAME")
    admin_password: str = Field(alias="ADMIN_PASSWORD")
    admin_full_name: str = Field(alias="ADMIN_FULL_NAME")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def database_url(self) -> str:
        if self.database_url_raw:
            return self.database_url_raw
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins_raw.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
