from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, campaigns, client, contacts, events, health
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Email AI Platform",
        version="v1-skeleton",
        description="Milestone 0 FastAPI skeleton. No real sending or AI is implemented.",
    )
    if settings.frontend_origin:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[settings.frontend_origin],
            allow_credentials=True,
            allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type"],
        )
    app.include_router(health.router)
    app.include_router(admin.router)
    app.include_router(client.router)
    app.include_router(campaigns.router)
    app.include_router(contacts.router)
    app.include_router(events.router)
    return app


app = create_app()
