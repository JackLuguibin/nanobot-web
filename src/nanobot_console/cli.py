"""CLI entry point for the nanobot-console server."""

from __future__ import annotations

import uvicorn

from nanobot_console.server.app import create_app
from nanobot_console.server.config import get_settings


def main() -> None:
    """Run the FastAPI server via uvicorn."""
    settings = get_settings()
    uvicorn.run(
        create_app(settings),
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.lower(),
        workers=settings.workers,
    )


if __name__ == "__main__":
    main()
