"""FastAPI application factory and lifecycle management."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

from nanobot_console.server.config import ServerSettings, get_settings
from nanobot_console.server.models import ErrorDetail, ErrorResponse
from nanobot_console.server.routers import health

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator


def create_app(settings: ServerSettings | None = None) -> FastAPI:
    """Build and return a fully-configured FastAPI application instance.

    Args:
        settings: Optional pre-built settings object. If omitted the
            singleton from ``get_settings()`` is used.

    Returns:
        A ready-to-mount FastAPI app. Call ``run_app()`` or pass it to
        a ASGI server such as uvicorn / hypercorn.
    """
    if settings is None:
        settings = get_settings()

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
        logger.info(
            "Starting nanobot-console server {} — listening on {}:{}",
            settings.version,
            settings.host,
            settings.port,
        )
        yield
        logger.info("Shutting down nanobot-console server")

    app = FastAPI(
        title=settings.title,
        description=settings.description,
        version=settings.version,
        lifespan=lifespan,
        docs_url=None if settings.reload else settings.docs_url,
        redoc_url=settings.redoc_url,
        openapi_url=settings.openapi_url,
        # Suppress default docs in production when reload is off
    )

    # CORS — must be registered before any routes
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount versioned API routes
    app.include_router(health.router, prefix=settings.api_prefix)

    # Global exception handlers ------------------------------------------------

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ErrorResponse(
                error=ErrorDetail(
                    code="VALIDATION_ERROR",
                    message="Request validation failed",
                    detail={"errors": exc.errors()},
                )
            ).model_dump(mode="json"),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        _request: Request, exc: Exception
    ) -> JSONResponse:
        logger.exception("Unhandled exception: {}", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(
                error=ErrorDetail(
                    code="INTERNAL_ERROR",
                    message="An unexpected error occurred",
                )
            ).model_dump(mode="json"),
        )

    # Root path (useful for health checks behind reverse proxies)
    @app.get("/", include_in_schema=False)
    async def root() -> dict[str, str]:
        return {"service": settings.title, "version": settings.version}

    return app
