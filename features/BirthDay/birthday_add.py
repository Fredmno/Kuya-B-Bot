import os
import uuid
import logging
from starlette.requests import Request
from starlette.responses import JSONResponse
from telegram import Update
from telegram.ext import ContextTypes

from features.registry import get_or_create_registry, update_registry_data

logger = logging.getLogger(__name__)

DEFAULT_GROUP_CHAT_ID = -1002607400749


def _get_target_chat_id():
    cid = os.getenv("GROUP_CHAT_ID") or os.getenv("BULLETIN_CHAT_ID")
    if cid:
        try:
            return int(str(cid).strip())
        except ValueError:
            pass
    return DEFAULT_GROUP_CHAT_ID


async def api_add_birthday(request: Request):
    """Handles adding a birthday via the WebApp."""
    try:
        data = await request.json()
        name = str(data.get("name", "")).strip()
        date_raw = str(data.get("date", "")).strip()

        if not name or not date_raw:
            return JSONResponse({"error": "Name and date are required"}, status_code=400)

        # Standardize date format to MM-DD
        parts = date_raw.split("-")
        if len(parts) == 3:  # YYYY-MM-DD
            formatted_date = f"{int(parts[1]):02d}-{int(parts[2]):02d}"
        elif len(parts) == 2:  # MM-DD
            formatted_date = f"{int(parts[0]):02d}-{int(parts[1]):02d}"
        else:
            formatted_date = date_raw

        bot = request.app.state.telegram_app.bot
        msg_id, registry = await get_or_create_registry(bot)
        birthdays = registry.setdefault("birthdays", [])

        new_bday = {
            "id": str(uuid.uuid4())[:8],
            "name": name,
            "date": formatted_date
        }
        birthdays.append(new_bday)

        saved = await update_registry_data(msg_id, registry, bot)
        if not saved:
            return JSONResponse({"error": "Failed to persist birthday to database"}, status_code=500)

        # Broadcast notification to the group chat
        target_chat = _get_target_chat_id()
        notification_text = (
            f"📅 **New Birthday Added!**\n\n"
            f"👤 **Name:** {name}\n"
            f"🎂 **Date:** `{formatted_date}`\n\n"
            "— *Kuya B Hub*"
        )
        try:
            await bot.send_message(
                chat_id=target_chat,
                text=notification_text,
                parse_mode="Markdown"
            )
        except Exception as notify_err:
            logger.warning(f"Could not forward birthday notification: {notify_err}")

        return JSONResponse({"success": True, "birthday": new_bday})
    except Exception as e:
        logger.error(f"api_add_birthday error: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


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
            target_chat = _get_target_chat_id()
            if update.effective_chat.id != target_chat:
                notification_text = (
                    f"📅 **New Birthday Added!**\n\n"
                    f"👤 **Name:** {name}\n"
                    f"🎂 **Date:** `{date_str}`\n\n"
                    "— *Kuya B Hub*"
                )
                try:
                    await context.bot.send_message(
                        chat_id=target_chat,
                        text=notification_text,
                        parse_mode="Markdown"
                    )
                except Exception as notify_err:
                    logger.warning(f"Could not forward birthday notification: {notify_err}")
        else:
            await update.message.reply_text("Failed to save birthday to registry.")
    except Exception as e:
        logger.error(f"command_add_birthday error: {e}", exc_info=True)
        await update.message.reply_text("An error occurred while saving birthday.")
