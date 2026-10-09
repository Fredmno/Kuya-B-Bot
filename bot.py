import os
import json
import logging
import re
from datetime import time
from zoneinfo import ZoneInfo
from contextlib import asynccontextmanager

import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import PlainTextResponse, JSONResponse, HTMLResponse
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles

from telegram import Update, BotCommand, BotCommandScopeDefault
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    ContextTypes,
)

from database import init_db
from features.word_game import register_word_game_handlers
from features.menu import kuya_b_menu, menu_callback_handler

# Clean modular imports
from features.BirthDay.Birthdays import (
    api_get_birthdays,
    api_add_birthday,
    api_delete_birthday,
    api_edit_birthday,
    check_and_send_daily_birthday_greetings,
    command_add_birthday,
)
from features.daily_logs.daily_logs import (
    api_get_daily_logs,
    api_save_daily_log,
    api_delete_daily_log,
)
from features.tracking.tracking import (
    api_track_user,
    api_get_users,
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)

APP_VERSION = "2.8.5"
BOT_TOKEN = os.getenv("BOT_TOKEN")
RENDER_EXTERNAL_URL = os.getenv("RENDER_EXTERNAL_URL", "").rstrip("/")
PORT = int(os.getenv("PORT", 10000))
VAULT_CHANNEL_ID = os.getenv("VAULT_CHANNEL_ID")
GROUP_CHAT_ID = os.getenv("GROUP_CHAT_ID")
ADMIN_USER_ID = os.getenv("ADMIN_USER_ID")

WEBHOOK_PATH = "/telegram"
WEBHOOK_URL = f"{RENDER_EXTERNAL_URL}{WEBHOOK_PATH}"

# Initialize application instance FIRST
application = Application.builder().token(BOT_TOKEN).build()


def get_vault_chat_id():
    vault_id = os.getenv("VAULT_CHANNEL_ID", "")
    if vault_id.startswith("-") or vault_id.isdigit():
        return int(vault_id)
    return vault_id


# ---------------------------------------------------------
# PERSISTENT TELEGRAM CHANNEL REGISTRY (PINNED MANIFEST)
# ---------------------------------------------------------
async def get_or_create_registry():
    channel_id = get_vault_chat_id()
    if not channel_id:
        return {"logs": [], "birthdays": [], "users": []}, None

    try:
        chat = await application.bot.get_chat(chat_id=channel_id)
        if chat.pinned_message and "#KUYA_B_REGISTRY" in (chat.pinned_message.text or ""):
            raw_match = re.search(r"#KUYA_B_REGISTRY:(\{.*\})", chat.pinned_message.text)
            if raw_match:
                return json.loads(raw_match.group(1)), chat.pinned_message.message_id
    except Exception as e:
        logging.warning(f"Error fetching pinned registry: {e}")

    return {"logs": [], "birthdays": [], "users": []}, None


async def save_registry(registry_data, existing_msg_id=None):
    channel_id = get_vault_chat_id()
    if not channel_id:
        return

    text = f"🗄️ **KUYA B PERMANENT VAULT REGISTRY**\nDO NOT DELETE\n\n`#KUYA_B_REGISTRY:{json.dumps(registry_data)}`"
    
    if existing_msg_id:
        try:
            await application.bot.edit_message_text(
                chat_id=channel_id,
                message_id=existing_msg_id,
                text=text,
                parse_mode="Markdown"
            )
            return
        except Exception:
            pass

    msg = await application.bot.send_message(
        chat_id=channel_id,
        text=text,
        parse_mode="Markdown"
    )
    try:
        await application.bot.pin_chat_message(chat_id=channel_id, message_id=msg.message_id)
    except Exception as e:
        logging.warning(f"Could not pin registry: {e}")


# ---------------------------------------------------------
# BOT COMMANDS & WEBHOOK
# ---------------------------------------------------------
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🤖 Kuya B is online!\n"
        "Use /kuyab to open your personal hub menu.\n"
        "Use /game to start Word Scramble."
    )


async def telegram_webhook(request: Request):
    data = await request.json()
    update = Update.de_json(data, application.bot)
    await application.process_update(update)
    return PlainTextResponse("OK")


async def health_check(request: Request):
    return PlainTextResponse(f"Kuya B Bot v{APP_VERSION} is operational.")


async def serve_index(request: Request):
    index_path = os.path.join("webapp", "index.html")
    if not os.path.exists(index_path):
        return PlainTextResponse("index.html not found", status_code=404)

    with open(index_path, "r", encoding="utf-8") as f:
        content = f.read()

    rendered = content.replace("{{ v }}", APP_VERSION)
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    }
    return HTMLResponse(rendered, headers=headers)


# ---------------------------------------------------------
# VAULT ITEM FORWARDING & UTILITY APIS
# ---------------------------------------------------------
async def api_forward_vault_item(request: Request):
    try:
        data = await request.json()
        raw_msg_id = data.get("messageId")
        user_id = data.get("userId")

        if not user_id or not raw_msg_id:
            return JSONResponse({"error": "Missing user_id or messageId"}, status_code=400)

        channel_id = get_vault_chat_id()
        if not channel_id:
            return JSONResponse({"error": "VAULT_CHANNEL_ID not configured"}, status_code=500)

        await application.bot.copy_message(
            chat_id=int(user_id),
            from_chat_id=channel_id,
            message_id=int(raw_msg_id),
        )
        return JSONResponse({"success": True})
    except Exception as e:
        logging.error(f"Error copying message from vault: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_cleanup_message(request: Request):
    try:
        data = await request.json()
        chat_id = data.get("chat_id")
        msg_id = data.get("message_id")

        if chat_id and msg_id:
            await application.bot.delete_message(
                chat_id=int(chat_id),
                message_id=int(msg_id),
            )
        return JSONResponse({"success": True})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=200)


async def api_send_birthday_greeting(request: Request):
    try:
        data = await request.json()
        chat_id = data.get("chat_id")
        name = data.get("name", "Friend")

        if not chat_id:
            return JSONResponse({"error": "No chat_id provided"}, status_code=400)

        greeting_text = (
            f"🎉🎂 **Happy Birthday, {name}!** 🎂🎉\n\n"
            "Wishing you good health, endless happiness, and many blessings ahead! "
            "Let's celebrate! 🥳✨\n\n"
            "— *Kuya B Hub*"
        )

        await application.bot.send_message(
            chat_id=int(chat_id),
            text=greeting_text,
            parse_mode="Markdown",
        )
        return JSONResponse({"success": True})
    except Exception as e:
        logging.error(f"Error sending birthday greeting: {e}", exc_info=True)
        return JSONResponse
