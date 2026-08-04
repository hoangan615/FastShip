"""Exports the backend's OpenAPI schema to shared/contracts/openapi.json so
the mobile app can optionally codegen TS types from it
(e.g. `npx openapi-typescript ../shared/contracts/openapi.json -o src/types/api.ts`).

Usage (from backend/, with the venv active):
    python ../scripts/export_openapi.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import fastapi_app  # noqa: E402

OUT_PATH = Path(__file__).resolve().parent.parent / "shared" / "contracts" / "openapi.json"


def main() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    schema = fastapi_app.openapi()
    OUT_PATH.write_text(json.dumps(schema, indent=2))
    print(f"Wrote OpenAPI schema to {OUT_PATH}")


if __name__ == "__main__":
    main()
