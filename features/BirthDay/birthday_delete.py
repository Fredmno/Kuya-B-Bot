import logging
from starlette.requests import Request
from starlette.responses import JSONResponse

from features.registry import get_or_create_registry, update_registry_data

logger = logging.getLogger(__name__)


async def api_delete_birthday(request: Request):
    """Handles deleting a birthday via WebApp."""
    try:
        bday_id = None

        # Check JSON payload
        if request.headers.get("content-type", "").startswith("application/json"):
            try:
                data = await request.json()
                bday_id = data.get("id") or data.get("bday_id")
            except Exception:
                pass

        # Check query parameters fallback (?id=xxx)
        if not bday_id:
            bday_id = request.query_params.get("id") or request.query_params.get("bday_id")

        if not bday_id:
            return JSONResponse({"error": "Birthday ID is required"}, status_code=400)

        bday_id_str = str(bday_id).strip()
        bot = request.app.state.telegram_app.bot
        msg_id, registry = await get_or_create_registry(bot)
        birthdays = registry.get("birthdays", [])

        initial_len = len(birthdays)
        filtered = [b for b in birthdays if str(b.get("id", "")).strip() != bday_id_str]

        if len(filtered) == initial_len:
            return JSONResponse({"error": "Birthday not found"}, status_code=404)

        registry["birthdays"] = filtered

        saved = await update_registry_data(msg_id, registry, bot)
        if not saved:
            return JSONResponse({"error": "Failed to persist deletion"}, status_code=500)

        return JSONResponse({"success": True})
    except Exception as e:
        logger.error(f"api_delete_birthday error: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)
