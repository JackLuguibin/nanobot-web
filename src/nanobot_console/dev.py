"""Run the repo Procfile via Honcho (same as ``honcho start``)."""

from __future__ import annotations


def main() -> None:
    """Start all processes defined in the project ``Procfile``."""
    try:
        from honcho.command import main as honcho_main
    except ImportError as exc:
        msg = 'Honcho is required. Install with: pip install -e ".[dev]"'
        raise SystemExit(msg) from exc
    honcho_main(["start"])


if __name__ == "__main__":
    main()
