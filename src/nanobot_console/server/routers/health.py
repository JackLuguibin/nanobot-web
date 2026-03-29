"""Health-check and test endpoints."""

from fastapi import APIRouter, status

from nanobot_console.server.config import get_settings
from nanobot_console.server.models import DataResponse, EchoRequest, EchoResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=DataResponse[dict],
    status_code=status.HTTP_200_OK,
    summary="Liveness probe",
)
async def health_check() -> DataResponse[dict]:
    """Return server health status.

    Ready for integration with orchestration systems (Kubernetes, etc.).
    """
    settings = get_settings()
    return DataResponse(
        data={
            "status": "ok",
            "version": settings.version,
        }
    )


@router.post(
    "/echo",
    response_model=EchoResponse,
    status_code=status.HTTP_200_OK,
    summary="Echo test",
)
async def echo(body: EchoRequest) -> EchoResponse:
    """Mirror the received payload back to the client.

    Useful for smoke-testing the API and validating request/response serialization.
    """
    return EchoResponse(
        content=body.content,
        metadata=body.metadata,
    )
