from fastapi import FastAPI

from app.api import admin, campaigns, client, contacts, events, health


def create_app() -> FastAPI:
    app = FastAPI(
        title="Email AI Platform",
        version="v1-skeleton",
        description="Milestone 0 FastAPI skeleton. No real sending or AI is implemented.",
    )
    app.include_router(health.router)
    app.include_router(admin.router)
    app.include_router(client.router)
    app.include_router(campaigns.router)
    app.include_router(contacts.router)
    app.include_router(events.router)
    return app


app = create_app()
