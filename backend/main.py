import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import health, auth, properties, bookings, payments, ical, ws, reviews, admin, owner, applications, agent, whatsapp

sentry_sdk.init(dsn=settings.SENTRY_DSN, traces_sample_rate=0.1)

app = FastAPI(title="StayNaivasha API", version="1.0.0", docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(health.router,      prefix="/api")
app.include_router(auth.router,        prefix="/api/auth")
app.include_router(properties.router,  prefix="/api/properties")
app.include_router(bookings.router,    prefix="/api/bookings")
app.include_router(payments.router,    prefix="/api/payments")
app.include_router(ical.router,        prefix="/api/ical")
app.include_router(reviews.router,     prefix="/api/reviews")
app.include_router(owner.router,       prefix="/api/owner")
app.include_router(admin.router,       prefix="/api/admin")
app.include_router(applications.router, prefix="/api/applications")
app.include_router(agent.router,        prefix="/api")
app.include_router(whatsapp.router,     prefix="/api")
app.include_router(ws.router)
