from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery = Celery("staynaivasha", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

celery.conf.beat_schedule = {
    "ical-sync-every-10-min": {
        "task": "app.workers.tasks.sync_all_icals",
        "schedule": crontab(minute="*/10"),   # every 10 min — narrow external-platform window to ~10 min
    },
    "send-checkin-reminders": {
        "task": "app.workers.tasks.send_checkin_reminders",
        "schedule": crontab(minute=0, hour=8),  # 8am EAT daily
    },
}
celery.conf.timezone = "Africa/Nairobi"
