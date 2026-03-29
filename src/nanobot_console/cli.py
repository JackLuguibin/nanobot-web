"""CLI entry point for the nanobot-console server."""

from __future__ import annotations

import uvicorn

from nanobot_console.server.app import create_app
from nanobot_console.server.config import get_settings


def main() -> None:
    """Run the FastAPI server via uvicorn."""
    settings = get_settings()
    app = create_app(settings)
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        workers=settings.effective_workers,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
