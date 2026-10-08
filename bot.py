import os
import json
import logging
import re
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

from database import init_db, get_db
from features.word_game import register_word_game_handlers
from features.menu import kuya_b_menu, menu_callback_handler

# Clean modular imports
from features.birthdays.database import init_birthday_db
from features.birthdays.router import (
    api_get_birthdays,
    api_add_birthday,
    api_delete_birthday,
    api_edit_birthday,
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)

APP_VERSION = "2.5.0"  # Increment to bust browser cache across all clients
BOT_TOKEN = os.getenv("BOT_TOKEN")
RENDER_EXTERNAL_URL = os.getenv("RENDER_EXTERNAL_URL", "").rstrip("/")
PORT = int(os.getenv("PORT", 10000))
VAULT_CHANNEL_ID = os.getenv("VAULT_CHANNEL_ID")

WEBHOOK_PATH = "/telegram"
WEBHOOK_URL = f"{RENDER_EXTERNAL_URL}{WEBHOOK_PATH}"

application = Application.builder().token(BOT_TOKEN).build()

# Fast in-memory cache for Vault channel logs
VAULT_LOGS_CACHE = []


def get_vault_chat_id():
    vault_id = os.getenv("VAULT_CHANNEL_ID", "")
    if vault_id.startswith("-") or vault_id.isdigit():
        return int(vault_id)
    return vault_id


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
# DAILY LOGS API (TELEGRAM VAULT STORAGE)
# ---------------------------------------------------------
async def api_save_daily_log(request: Request):
    try:
        data = await request.json()
        mood = data.get("mood", "😊")
        content = data.get("content", "").strip()
        date_str = data.get("date", "")
        time_str = data.get("time", "")

        channel_id = get_vault_chat_id()
        if not channel_id:
            return JSONResponse({"error": "VAULT_CHANNEL_ID not set in environment"}, status_code=500)

        # Machine-readable metadata payload encoded directly into Telegram message
        metadata_json = json.dumps({"mood": mood, "date": date_str, "time": time_str})

        message_text = (
            f"📅 **DAILY LOG**\n"
            f"**Date:** {date_str} • {time_str}\n"
            f"**Mood:** {mood}\n\n"
            f"{content if content else '_(No notes added)_'}\n\n"
            f"`#DAILY_LOG:{metadata_json}`"
        )

        sent_msg = await application.bot.send_message(
            chat_id=channel_id,
            text=message_text,
            parse_mode="Markdown"
        )

        log_entry = {
            "id": str(sent_msg.message_id),
            "message_id": sent_msg.message_id,
            "mood": mood,
            "content": content,
            "date": date_str,
            "time": time_str
        }

        # Store in volatile cache for instant retrieval
        VAULT_LOGS_CACHE.insert(0, log_entry)

        return JSONResponse({"success": True, "log": log_entry})
    except Exception as e:
        logging.error(f"Error posting daily log to vault channel: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_get_daily_logs(request: Request):
    return JSONResponse({"success": True, "logs": VAULT_LOGS_CACHE})


async def api_delete_daily_log(request: Request):
    global VAULT_LOGS_CACHE
    try:
        data = await request.json()
        msg_id = data.get("id")
        if not msg_id:
            return JSONResponse({"error": "Missing message id"}, status_code=400)

        channel_id = get_vault_chat_id()

        # Delete message from Telegram Vault channel
        try:
            await application.bot.delete_message(chat_id=channel_id, message_id=int(msg_id))
        except Exception as bot_err:
            logging.warning(f"Message {msg_id} already removed or not found: {bot_err}")

        # Remove from local cache
        VAULT_LOGS_CACHE = [item for item in VAULT_LOGS_CACHE if str(item.get("id")) != str(msg_id)]

        return JSONResponse({"success": True})
    except Exception as e:
        logging.error(f"Error deleting daily log from vault channel: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


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
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------------------------------------------------------
# LIFESPAN & APPLICATION STARTUP
# ---------------------------------------------------------
@asynccontextmanager
async def lifespan(app):
    init_db()
    init_birthday_db()

    await application.initialize()
    await application.bot.set_webhook(WEBHOOK_URL)

    try:
        commands = [
            BotCommand("kuyab", "Open Kuya B Personal Hub"),
            BotCommand("game", "Play Word Scramble"),
        ]
        await application.bot.set_my_commands(commands, scope=BotCommandScopeDefault())
    except Exception as e:
        logging.warning(f"Could not register commands: {e}")

    await application.start()
    yield
    await application.stop()
    await application.shutdown()


# Register Bot Handlers
application.add_handler(CommandHandler("start", start))
application.add_handler(CommandHandler("kuyab", kuya_b_menu))
application.add_handler(CommandHandler("kuya_b", kuya_b_menu))
application.add_handler(CallbackQueryHandler(menu_callback_handler))
register_word_game_handlers(application)

# Define Starlette App & Endpoints
starlette_app = Starlette(
    routes=[
        Route("/", health_check, methods=["GET", "HEAD"]),
        Route(WEBHOOK_PATH, telegram_webhook, methods=["POST"]),
        
        # Birthday Routes
        Route("/api/birthdays", api_get_birthdays, methods=["GET"]),
        Route("/api/birthdays", api_add_birthday, methods=["POST"]),
        Route("/api/birthdays/edit", api_edit_birthday, methods=["POST"]),
        Route("/api/birthdays/delete", api_delete_birthday, methods=["POST"]),
        Route("/api/birthdays/greet", api_send_birthday_greeting, methods=["POST"]),
        
        # Vault Channel Daily Logs Routes
        Route("/api/logs", api_get_daily_logs, methods=["GET"]),
        Route("/api/logs", api_save_daily_log, methods=["POST"]),
        Route("/api/logs/delete", api_delete_daily_log, methods=["POST"]),

        # Vault Item & Utility Routes
        Route("/api/vault/forward", api_forward_vault_item, methods=["POST"]),
        Route("/api/cleanup-message", api_cleanup_message, methods=["POST"]),
        
        # Mini App Static Front-end Mounts
        Route("/app", serve_index, methods=["GET"]),
        Route("/app/", serve_index, methods=["GET"]),
        Mount("/app", StaticFiles(directory="webapp", html=False), name="app"),
    ],
    lifespan=lifespan,
)

if __name__ == "__main__":
    uvicorn.run(starlette_app, host="0.0.0.0", port=PORT)

