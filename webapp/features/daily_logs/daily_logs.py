import json
import logging
from starlette.requests import Request
from starlette.responses import JSONResponse
from features.registry import get_or_create_registry, update_registry_data
from features.daily_logs.user_access.access_control import is_user_authorized

logger = logging.getLogger(__name__)


async def api_get_daily_logs(request: Request):
    """Returns logs only if the user has verified authorization."""
    user_id = request.query_params.get("user_id")

    if not is_user_authorized(user_id):
        return JSONResponse({
            "success": True,
            "access": False,
            "message": "Daily Logs are private."
        })

    reg = get_or_create_registry("daily_logs", default_value=[])
    logs = reg.get("data", [])
    if isinstance(logs, str):
        try:
            logs = json.loads(logs)
        except Exception:
            logs = []

    return JSONResponse({
        "success": True,
        "access": True,
        "logs": logs
    })


async def api_save_daily_log(request: Request):
    """Saves a log entry if authorized."""
    try:
        data = await request.json()
        user_id = data.get("user_id")

        if not is_user_authorized(user_id):
            return JSONResponse({"success": False, "error": "Unauthorized"}, status_code=403)

        reg = get_or_create_registry("daily_logs", default_value=[])
        logs = reg.get("data", [])
        if isinstance(logs, str):
            try:
                logs = json.loads(logs)
            except Exception:
                logs = []

        logs.insert(0, data)
        update_registry_data("daily_logs", logs)
        return JSONResponse({"success": True})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def api_delete_daily_log(request: Request):
    """Deletes a log entry if authorized."""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        log_id = data.get("id")

        if not is_user_authorized(user_id):
            return JSONResponse({"success": False, "error": "Unauthorized"}, status_code=403)

        reg = get_or_create_registry("daily_logs", default_value=[])
        logs = reg.get("data", [])
        if isinstance(logs, str):
            try:
                logs = json.loads(logs)
            except Exception:
                logs = []

        logs = [item for item in logs if item.get("id") != log_id]
        update_registry_data("daily_logs", logs)
        return JSONResponse({"success": True})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)
