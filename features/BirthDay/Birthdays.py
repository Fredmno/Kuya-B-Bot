import uuid
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from starlette.requests import Request
from starlette.responses import JSONResponse
from telegram import Update
from telegram.ext import ContextTypes

# Import from independent registry module
from features.registry import get_or_create_registry, update_registry_data

logger = logging.getLogger(__name__)


def _get_bot_from_request(request: Request):
    """Extracts bot instance from Starlette application state."""
    return request.app.state.telegram_app.bot


async def api_get_birthdays(request: Request):
    try:
        bot = _get_bot_from_request(request)
        _, registry = await get_or_create_registry(bot)
        birthdays = registry.get("birthdays", [])
        return JSONResponse({"birthdays": birthdays})
    except Exception as e:
        logger.error(f"api_get_birthdays error: {e}", exc_info=True)
        return JSONResponse({"error": str(e), "birthdays": []}, status_code=500)


async def api_add_birthday(request: Request):
    try:
        data = await request.json()
        name = data.get("name", "").strip()
        date = data.get("date", "").strip()

        if not name or not date:
            return JSONResponse({"error": "Name and date are required"}, status_code=400)

        bot = _get_bot_from_request(request)
        msg_id, registry = await get_or_create_registry(bot)
        birthdays = registry.setdefault("birthdays", [])

        new_bday = {
            "id": str(uuid.uuid4())[:8],
            "name": name,
            "date": date
        }
        birthdays.append(new_bday)

        saved = await update_registry_data(msg_id, registry, bot)
        if not saved:
            return JSONResponse({"error": "Failed to persist birthday"}, status_code=500)

        return JSONResponse({"success": True, "birthday": new_bday})
    except Exception as e:
        logger.error(f"api_add_birthday error: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_edit_birthday(request: Request):
    try:
        data = await request.json()
        bday_id = data.get("id")
        name = data.get("name", "").strip()
        date = data.get("date", "").strip()

        if not bday_id or not name or not date:
            return JSONResponse({"error": "ID, name, and date are required"}, status_code=400)

        bot = _get_bot_from_request(request)
        msg_id, registry = await get_or_create_registry(bot)
        birthdays = registry.get("birthdays", [])

        found = False
        for b in birthdays:
            if str(b.get("id")) == str(bday_id):
                b["name"] = name
                b["date"] = date
                found = True
                break

        if not found:
            return JSONResponse({"error": "Birthday not found"}, status_code=404)

        saved = await update_registry_data(msg_id, registry, bot)
        if not saved:
            return JSONResponse({"error": "Failed to persist birthday update"}, status_code=500)

        return JSONResponse({"success": True})
    except Exception as e:
        logger.error(f"api_edit_birthday error: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_delete_birthday(request: Request):
    try:
        data = await request.json()
        bday_id = data.get("id")

        if not bday_id:
            return JSONResponse({"error": "Birthday ID is required"}, status_code=400)

        bot = _get_bot_from_request(request)
        msg_id, registry = await get_or_create_registry(bot)
        birthdays = registry.get("birthdays", [])

        filtered = [b for b in birthdays if str(b.get("id")) != str(bday_id)]
        registry["birthdays"] = filtered

        saved = await update_registry_data(msg_id, registry, bot)
        if not saved:
            return JSONResponse({"error": "Failed to persist deletion"}, status_code=500)

        return JSONResponse({"success": True})
    except Exception as e:
        logger.error(f"api_delete_birthday error: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


async def check_and_send_daily_birthday_greetings(context: ContextTypes.DEFAULT_TYPE):
    """Daily scheduled background job checking for birthdays."""
    try:
        bot = context.bot
        _, registry = await get_or_create_registry(bot)
        birthdays = registry.get("birthdays", [])

        try:
            now = datetime.now(ZoneInfo("Asia/Manila"))
        except Exception:
            now = datetime.now()

        today_str = now.strftime("%m-%d")

        for b in birthdays:
            if b.get("date") == today_str:
                logger.info(f"Today is {b.get('name')}'s birthday!")
    except Exception as e:
        logger.error(f"Error checking daily birthdays: {e}", exc_info=True)


async def command_add_birthday(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Telegram bot command /bday Name MM-DD"""
    try:
        args = context.args
        if len(args) < 2:
            await update.message.reply_text("Usage: /bday [Name] [MM-DD]\nExample: /bday Juan 05-23")
            return

        date_str = args[-1]
        name = " ".join(args[:-1])

        msg_id, registry = await get_or_create_registry(context.bot)
        birthdays = registry.setdefault("birthdays", [])

        new_bday = {
            "id": str(uuid.uuid4())[:8],
            "name": name,
            "date": date_str
        }
        birthdays.append(new_bday)

        saved = await update_registry_data(msg_id, registry, context.bot)
        if saved:
            await update.message.reply_text(f"🎉 Added birthday for {name} on {date_str}!")
        else:
            await update.message.reply_text("Failed to save birthday to registry.")
    except Exception as e:
        logger.error(f"command_add_birthday error: {e}", exc_info=True)
        await update.message.reply_text("An error occurred while saving birthday.")
