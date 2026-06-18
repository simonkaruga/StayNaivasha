from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery = Celery("staynaivasha", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

celery.conf.beat_schedule = {
    "ical-sync-every-10-min": {
        "task": "app.workers.tasks.sync_all_icals",
        "schedule": crontab(minute="*/10"),
    },
    "send-checkin-reminders": {
        "task": "app.workers.tasks.send_checkin_reminders",
        "schedule": crontab(minute=0, hour=8),   # 8 am EAT
    },
    "auto-complete-bookings": {
        "task": "app.workers.tasks.auto_complete_bookings",
        "schedule": crontab(minute=0, hour=2),   # 2 am EAT — quiet hours
    },
}
celery.conf.timezone = "Africa/Nairobi"
