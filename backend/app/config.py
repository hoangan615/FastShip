from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "FastShip"
    debug: bool = False

    database_url: str = "postgresql+asyncpg://fastship:fastship@localhost:5432/fastship"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    escrow_buffer_hours: int = 48
    match_radius_km: float = 5.0
    offer_timeout_seconds: int = 20
    merchant_response_window_seconds: int = 300
    match_lock_ttl_seconds: int = 30
    shipper_offline_after_seconds: int = 30
    sla_minutes: int = 60

    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"


@lru_cache
def get_settings() -> Settings:
    return Settings()
