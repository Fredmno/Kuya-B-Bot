import json
import logging
from starlette.requests import Request
from starlette.responses import JSONResponse
from telegram import Update
from telegram.ext import ContextTypes

from config import ADMIN_USER_ID
from features.registry import get_or_create_registry, update_registry_data

logger = logging.getLogger(__name__)

ACCESS_REGISTRY_KEY = "daily_logs_access"


def get_access_data() -> dict:
    """Retrieves current approved list and pending access requests."""
    reg = get_or_create_registry(ACCESS_REGISTRY_KEY, default_value={"approved": [], "pending": []})
    data = reg.get("data")
    if isinstance(data, str):
        try:
            return json.loads(data)
        except Exception:
            return {"approved": [], "pending": []}
    return data or {"approved": [], "pending": []}


def is_user_authorized(user_id: str) -> bool:
    """Checks if a user is the owner or an approved viewer."""
    if not user_id:
        return False
    user_id_str = str(user_id)
    if str(ADMIN_USER_ID) == user_id_str:
        return True
    access_data = get_access_data()
    return user_id_str in [str(u) for u in access_data.get("approved", [])]


async def api_request_daily_logs_access(request: Request):
    """Submits an access request and alerts the admin via Telegram."""
    try:
        data = await request.json()
        user_id = str(data.get("user_id", ""))
        user_name = data.get("name", "Unknown User")
        username = data.get("username", "")

        if not user_id:
            return JSONResponse({"success": False, "error": "User ID missing"}, status_code=400)

        if is_user_authorized(user_id):
            return JSONResponse({"success": True, "status": "already_approved"})

        access_data = get_access_data()
        pending = access_data.get("pending", [])

        existing = next((p for p in pending if str(p.get("id")) == user_id), None)
        if not existing:
            pending.append({
                "id": user_id,
                "name": user_name,
                "username": username
            })
            access_data["pending"] = pending
            update_registry_data(ACCESS_REGISTRY_KEY, access_data)

        # Alert the Admin in Telegram
        tg_app = getattr(request.app.state, "telegram_app", None)
        if tg_app and ADMIN_USER_ID:
            msg = (
                f"🔒 *Daily Logs Access Request*\n\n"
                f"👤 *User:* {user_name} (@{username if username else 'N/A'})\n"
                f"🆔 *ID:* `{user_id}`\n\n"
                f"Reply `/approve_logs {user_id}` to grant access."
            )
            try:
                await tg_app.bot.send_message(chat_id=int(ADMIN_USER_ID), text=msg, parse_mode="Markdown")
            except Exception as e:
                logger.warning(f"Failed to send access request alert: {e}")

        return JSONResponse({"success": True, "status": "pending"})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def api_approve_daily_logs_access(request: Request):
    """API endpoint to approve access for a specific user ID."""
    try:
        data = await request.json()
        admin_id = str(data.get("admin_id", ""))
        target_user_id = str(data.get("user_id", ""))

        if admin_id != str(ADMIN_USER_ID):
            return JSONResponse({"success": False, "error": "Unauthorized"}, status_code=403)

        access_data = get_access_data()
        approved = access_data.get("approved", [])
        pending = access_data.get("pending", [])

        if target_user_id not in approved:
            approved.append(target_user_id)

        access_data["pending"] = [p for p in pending if str(p.get("id")) != target_user_id]
        access_data["approved"] = approved
        update_registry_data(ACCESS_REGISTRY_KEY, access_data)

        return JSONResponse({"success": True, "approved_user": target_user_id})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def command_approve_logs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin command handler (/approve_logs <user_id>) in Telegram chat."""
    user_id = str(update.effective_user.id)
    if user_id != str(ADMIN_USER_ID):
        return

    if not context.args:
        await update.message.reply_text("Usage: `/approve_logs <user_id>`", parse_mode="Markdown")
        return

    target_id = context.args[0]
    access_data = get_access_data()
    approved = access_data.get("approved", [])

    if target_id not in approved:
        approved.append(target_id)

    access_data["approved"] = approved
    access_data["pending"] = [p for p in access_data.get("pending", []) if str(p.get("id")) != target_id]
    update_registry_data(ACCESS_REGISTRY_KEY, access_data)

    await update.message.reply_text(f"✅ Access granted to user `{target_id}`.", parse_mode="Markdown")
