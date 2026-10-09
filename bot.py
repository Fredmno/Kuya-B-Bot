import os
import logging
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
    MessageHandler,
    filters,
    ContextTypes,
)

from config import APP_VERSION, BOT_TOKEN, WEBHOOK_URL, WEBHOOK_PATH, PORT, ADMIN_USER_ID
from database import init_db

# Shared registry helpers
from features.registry import get_or_create_registry, update_registry_data

# Feature Imports
from features.word_game import register_word_game_handlers
from features.menu import kuya_b_menu, menu_callback_handler
from features.business.assistant import handle_business_message
from features.downloader import api_download_link_to_vault
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
from features.vault import (
    api_upload_vault_media,
    api_get_vault_media_file,
    api_get_vault_items,
    api_delete_vault_item,
)
from features.admin.github_sync import (
    api_admin_commit_file,
    api_admin_get_repo_tree,
    api_admin_get_file_content,
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)

application = Application.builder().token(BOT_TOKEN).build()


# ---------------------------------------------------------
# BOT COMMANDS & WEBHOOKS
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


async def api_cleanup_message(request: Request):
    try:
        data = await request.json()
        chat_id = data.get("chat_id")
        msg_id = data.get("message_id")
        if chat_id and msg_id:
            await application.bot.delete_message(chat_id=int(chat_id), message_id=int(msg_id))
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
            "Wishing you good health, endless happiness, and many blessings ahead! ✨\n\n"
            "— *Kuya B Hub*"
        )
        await application.bot.send_message(chat_id=int(chat_id), text=greeting_text, parse_mode="Markdown")
        return JSONResponse({"success": True})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------------------------------------------------------
# LIFESPAN & APPLICATION STARTUP
# ---------------------------------------------------------
@asynccontextmanager
async def lifespan(app):
    app.state.telegram_app = application
    init_db()

    await application.initialize()

    allowed_updates_list = [
        "message",
        "edited_message",
        "callback_query",
        "inline_query",
        "chosen_inline_result",
        "business_connection",
        "business_message",
        "edited_business_message",
        "deleted_business_messages",
    ]

    await application.bot.set_webhook(
        url=WEBHOOK_URL,
        allowed_updates=allowed_updates_list,
        drop_pending_updates=False,
    )

    if application.job_queue:
        try:
            local_tz = ZoneInfo("Asia/Manila")
            daily_time = time(hour=9, minute=0, second=0, tzinfo=local_tz)
        except Exception:
            daily_time = time(hour=9, minute=0, second=0)

        application.job_queue.run_daily(
            check_and_send_daily_birthday_greetings,
            time=daily_time,
            name="daily_morning_bulletin_job",
        )

    try:
        commands = [
            BotCommand("kuyab", "Open Kuya B Personal Hub"),
            BotCommand("game", "Play Word Scramble"),
        ]
        await application.bot.set_my_commands(commands, scope
