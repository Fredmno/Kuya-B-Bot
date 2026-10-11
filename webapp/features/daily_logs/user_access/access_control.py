import logging
from starlette.requests import Request
from starlette.responses import JSONResponse
from telegram import Update
from telegram.ext import ContextTypes
from config import ADMIN_ID
from features.registry import get_or_create_registry, update_registry_data

logger = logging.getLogger(__name__)
ACCESS_REGISTRY_KEY = "daily_logs_access"


def _get_access_list() -> list:
    reg = get_or_create_registry(ACCESS_REGISTRY_KEY, default_value=[])
    data = reg.get("data", [])
    if isinstance(data, list):
        return data
    return []


async def api_request_daily_logs_access(request: Request):
    """Handles an access request submitted from the WebApp lock screen."""
    try:
        body = await request.json()
        user_id = str(body.get("user_id") or "").strip()
        user_name = body.get("name") or "Anonymous"

        if not user_id:
            return JSONResponse({"success": False, "error": "User ID required"}, status_code=400)

        # Auto-grant access if the user is the admin
        if str(user_id) == str(ADMIN_ID):
            access_list = _get_access_list()
            if user_id not in access_list:
                access_list.append(user_id)
                update_registry_data(ACCESS_REGISTRY_KEY, access_list)
            return JSONResponse({"success": True, "status": "approved"})

        access_list = _get_access_list()
        if user_id in access_list:
            return JSONResponse({"success": True, "status": "approved"})

        # Send an approval request message to Admin via Telegram
        app = request.app.state.telegram_app
        if app and ADMIN_ID:
            msg = (
                f"🔒 *Daily Logs Access Request*\n\n"
                f"• *User:* {user_name}\n"
                f"• *ID:* `{user_id}`\n\n"
                f"To approve, reply or run:\n`/approve_logs {user_id}`"
            )
            await app.bot.send_message(chat_id=ADMIN_ID, text=msg, parse_mode="Markdown")

        return JSONResponse({"success": True, "status": "pending"})
    except Exception as e:
        logger.error(f"Error in api_request_daily_logs_access: {e}")
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def api_approve_daily_logs_access(request: Request):
    """Admin endpoint to approve user access."""
    try:
        body = await request.json()
        user_id = str(body.get("user_id") or "").strip()
        admin_key = str(body.get("admin_id") or "").strip()

        if admin_key != str(ADMIN_ID):
            return JSONResponse({"success": False, "error": "Unauthorized"}, status_code=403)

        access_list = _get_access_list()
        if user_id and user_id not in access_list:
            access_list.append(user_id)
            update_registry_data(ACCESS_REGISTRY_KEY, access_list)

        return JSONResponse({"success": True, "approved": user_id})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def command_approve_logs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Telegram bot command: /approve_logs <user_id>"""
    sender_id = str(update.effective_user.id)
    if sender_id != str(ADMIN_ID):
        await update.message.reply_text("⛔ Unauthorized command.")
        return

    if not context.args:
        await update.message.reply_text("Usage: `/approve_logs <user_id>`", parse_mode="Markdown")
        return

    target_id = str(context.args[0]).strip()
    access_list = _get_access_list()

    if target_id not in access_list:
        access_list.append(target_id)
        update_registry_data(ACCESS_REGISTRY_KEY, access_list)

    await update.message.reply_text(f"✅ User `{target_id}` has been granted access to Daily Logs.", parse_mode="Markdown")
