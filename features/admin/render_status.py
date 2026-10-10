import os
import httpx
import logging
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

RENDER_API_BASE = "https://api.render.com/v1"


def _get_headers():
    api_key = os.getenv("RENDER_API_KEY", "")
    return {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json"
    }


async def api_get_deploy_status(request: Request):
    """
    Fetches the status of the most recent deployment from Render.
    Returns: status ('live', 'build_in_progress', 'build_failed', etc.),
    commit message, time, and deploy ID.
    """
    api_key = os.getenv("RENDER_API_KEY")
    service_id = os.getenv("RENDER_SERVICE_ID")

    if not api_key or not service_id:
        return JSONResponse({
            "success": False,
            "error": "RENDER_API_KEY or RENDER_SERVICE_ID is not configured in environment variables."
        }, status_code=500)

    url = f"{RENDER_API_BASE}/services/{service_id}/deploys?limit=1"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=_get_headers())

            if resp.status_code != 200:
                logger.error(f"Render API error {resp.status_code}: {resp.text}")
                return JSONResponse({
                    "success": False,
                    "error": f"Render API responded with status {resp.status_code}"
                }, status_code=resp.status_code)

            data = resp.json()
            if not data or not isinstance(data, list) or len(data) == 0:
                return JSONResponse({"success": False, "error": "No deployments found."})

            latest = data[0].get("deploy", {})
            deploy_id = latest.get("id")
            status = latest.get("status")  # 'live', 'build_in_progress', 'build_failed', 'canceled'
            commit = latest.get("commit", {})
            created_at = latest.get("createdAt")
            finished_at = latest.get("finishedAt")

            return JSONResponse({
                "success": True,
                "deploy_id": deploy_id,
                "status": status,
                "commit_message": commit.get("message", "N/A"),
                "commit_id": commit.get("id", "N/A")[:7],
                "created_at": created_at,
                "finished_at": finished_at
            })

    except Exception as e:
        logger.error(f"Failed to fetch Render deploy status: {e}", exc_info=True)
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)
