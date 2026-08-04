from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "fastship",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.workers.tasks_orders",
        "app.workers.tasks_matching",
        "app.workers.tasks_escrow",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

from app.workers.beat_schedule import BEAT_SCHEDULE  # noqa: E402

celery_app.conf.beat_schedule = BEAT_SCHEDULE
