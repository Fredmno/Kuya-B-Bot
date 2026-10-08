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

from database import init_db
from features.word_game import register_word_game_handlers
from features.menu import kuya_b_menu, menu_callback_handler

# Clean modular Birthday imports
from features.BirthDay.Birthdays import (
    api_get_birthdays,
    api_add_birthday,
    api_delete_birthday,
    api_edit_birthday,
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)

APP_VERSION = "2.7.0"
BOT_TOKEN = os.getenv("BOT_TOKEN")
RENDER_EXTERNAL_URL = os.getenv("RENDER_EXTERNAL_URL", "").rstrip("/")
PORT = int(os.getenv("PORT", 10000))
VAULT_CHANNEL_ID = os.getenv("VAULT_CHANNEL_ID")

WEBHOOK_PATH = "/telegram"
WEBHOOK_URL = f"{RENDER_EXTERNAL_URL}{WEBHOOK_PATH}"

application = Application.builder().token(BOT_TOKEN).build()


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
# PERSISTENT TELEGRAM CHANNEL REGISTRY (PINNED MESSAGE INDEX)
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
# DAILY LOGS API (PERMANENT VAULT STORAGE)
# ---------------------------------------------------------
async def api_save_daily_log(request: Request):
    try:
        data = await request.json()
        mood = data.get("mood", "😊")
        habits = data.get("habits", [])
        content = data.get("content", "").strip()
        date_str = data.get("date", "")
        time_str = data.get("time", "")

        channel_id = get_vault_chat_id()
        if not channel_id:
            return JSONResponse({"error": "VAULT_CHANNEL_ID not set"}, status_code=500)

        metadata_json = json.dumps({"mood": mood, "habits": habits, "date": date_str, "time": time_str})

        habits_formatted = ""
        if habits:
            habits_formatted = "\n\n**✅ Habits Completed:**\n" + "\n".join([f"• {h}" for h in habits])

        message_text = (
            f"📅 **DAILY LOG**\n"
            f"**Date:** {date_str} • {time_str}\n"
            f"**Mood:** {mood}"
            f"{habits_formatted}\n\n"
            f"**Notes:**\n{content if content else '_(No notes added)_'}\n\n"
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
            "habits": habits,
            "content": content,
            "date": date_str,
            "time": time_str
        }

        # Save to permanent channel registry
        reg, msg_id = await get_or_create_registry()
        reg_logs = reg.get("logs", [])
        reg_logs.insert(0, log_entry)
        reg["logs"] = reg_logs
        await save_registry(reg, msg_id)

        return JSONResponse({"success": True, "log": log_entry})
    except Exception as e:
        logging.error(f"Error posting daily log: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_get_daily_logs(request: Request):
    reg, _ = await get_or_create_registry()
    return JSONResponse({"success": True, "logs": reg.get("logs", [])})


async def api_delete_daily_log(request: Request):
    try:
        data = await request.json()
        msg_id = data.get("id")
        if not msg_id:
            return JSONResponse({"error": "Missing message id"}, status_code=400)

        channel_id = get_vault_chat_id()

        try:
            await application.bot.delete_message(chat_id=channel_id, message_id=int(msg_id))
        except Exception as bot_err:
            logging.warning(f"Could not delete message {msg_id}: {bot_err}")

        reg, p_msg_id = await get_or_create_registry()
        reg["logs"] = [item for item in reg.get("logs", []) if str(item.get("id")) != str(msg_id)]
        await save_registry(reg, p_msg_id)

        return JSONResponse({"success": True})
    except Exception as e:
        logging.error(f"Error deleting daily log: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------------------------------------------------------
# USER TRACKING APIS
# ---------------------------------------------------------
async def api_track_user(request: Request):
    try:
        data = await request.json()
        user_id = str(data.get("id"))
        first_name = data.get("first_name", "Unknown")
        username = data.get("username", "N/A")
        timestamp = data.get("timestamp", "")

        if not user_id:
            return JSONResponse({"error": "No user ID"}, status_code=400)

        reg, p_msg_id = await get_or_create_registry()
        users_list = reg.get("users", [])

        # Update existing user or add new
        found = False
        for u in users_list:
            if str(u.get("id")) == user_id:
                u["first_name"] = first_name
                u["username"] = username
                u["last_seen"] = timestamp
                u["visits"] = u.get("visits", 1) + 1
                found = True
                break

        if not found:
            users_list.insert(0, {
                "id": user_id,
                "first_name": first_name,
                "username": username,
                "last_seen": timestamp,
                "visits": 1
            })

        reg["users"] = users_list
        await save_registry(reg, p_msg_id)

        return JSONResponse({"success": True})
    except Exception as e:
        logging.error(f"Error tracking user: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_get_users(request: Request):
    reg, _ = await get_or_create_registry()
    return JSONResponse({"success": True, "users": reg.get("users", [])})


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


# Handlers
application.add_handler(CommandHandler("start", start))
application.add_handler(CommandHandler("kuyab", kuya_b_menu))
application.add_handler(CommandHandler("kuya_b", kuya_b_menu))
application.add_handler(CallbackQueryHandler(menu_callback_handler))
register_word_game_handlers(application)

# Routes
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

        # User Tracking Routes
        Route("/api/track-user", api_track_user, methods=["POST"]),
        Route("/api/users", api_get_users, methods=["GET"]),

        # Vault Forward & Utility Routes
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
