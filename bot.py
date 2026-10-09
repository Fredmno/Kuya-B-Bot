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
from starlette.responses import PlainTextResponse, JSONResponse, HTMLResponse, Response
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from starlette.datastructures import UploadFile

from telegram import Update, BotCommand, BotCommandScopeDefault
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
    ContextTypes,
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)

APP_VERSION = "2.9.4"
BOT_TOKEN = os.getenv("BOT_TOKEN")
RENDER_EXTERNAL_URL = os.getenv("RENDER_EXTERNAL_URL", "").rstrip("/")
PORT = int(os.getenv("PORT", 10000))
VAULT_CHANNEL_ID = os.getenv("VAULT_CHANNEL_ID")
GROUP_CHAT_ID = os.getenv("GROUP_CHAT_ID")
ADMIN_USER_ID = os.getenv("ADMIN_USER_ID")

WEBHOOK_PATH = "/telegram"
WEBHOOK_URL = f"{RENDER_EXTERNAL_URL}{WEBHOOK_PATH}"

# Application instance initialization
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
        return {"logs": [], "birthdays": [], "vault": [], "users": []}, None

    try:
        chat = await application.bot.get_chat(chat_id=channel_id)
        if chat.pinned_message and "#KUYA_B_REGISTRY" in (chat.pinned_message.text or ""):
            raw_match = re.search(r"#KUYA_B_REGISTRY:(\{.*\})", chat.pinned_message.text)
            if raw_match:
                data = json.loads(raw_match.group(1))
                if "vault" not in data:
                    data["vault"] = []
                return data, chat.pinned_message.message_id
    except Exception as e:
        logging.warning(f"Error fetching pinned registry: {e}")

    return {"logs": [], "birthdays": [], "vault": [], "users": []}, None


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
# IMPORT FEATURE MODULES
# ---------------------------------------------------------
from database import init_db
from features.word_game import register_word_game_handlers
from features.menu import kuya_b_menu, menu_callback_handler
from features.business.assistant import handle_business_message

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
# VAULT MANAGEMENT & IN-APP DIRECT STREAMING (VIDEO & PHOTO)
# ---------------------------------------------------------
async def api_upload_vault_media(request: Request):
    """Receives file upload from Mini App and forwards to Vault Channel."""
    try:
        form = await request.form()
        file: UploadFile = form.get("file")
        title = form.get("title", "Untitled").strip() or "Untitled"
        folder = form.get("folder", "General").strip() or "General"
        media_type = form.get("type", "pictures").strip()

        if not file:
            return JSONResponse({"error": "No file uploaded"}, status_code=400)

        channel_id = get_vault_chat_id()
        if not channel_id:
            return JSONResponse({"error": "VAULT_CHANNEL_ID not configured"}, status_code=500)

        file_bytes = await file.read()
        caption = f"📁 **VAULT MEDIA**\n🏷️ **Title:** {title}\n📂 **Folder:** #{folder}"

        saved_file_id = None
        if media_type == "pictures":
            sent = await application.bot.send_photo(
                chat_id=channel_id,
                photo=file_bytes,
                caption=caption,
                parse_mode="Markdown"
            )
            saved_file_id = sent.photo[-1].file_id
        else:
            sent = await application.bot.send_video(
                chat_id=channel_id,
                video=file_bytes,
                caption=caption,
                parse_mode="Markdown"
            )
            saved_file_id = sent.video.file_id

        reg, p_id = await get_or_create_registry()
        vault_list = reg.get("vault", [])
        entry = {
            "id": str(sent.message_id),
            "type": media_type,
            "title": title,
            "folder": folder,
            "messageId": str(sent.message_id),
            "fileId": saved_file_id
        }
        vault_list.append(entry)
        reg["vault"] = vault_list
        await save_registry(reg, p_id)

        return JSONResponse({"success": True, "item": entry})
    except Exception as e:
        logging.error(f"Error handling media upload to vault: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_get_vault_media_file(request: Request):
    """Streams media file directly to the Mini App with proper MIME type."""
    item_id = request.query_params.get("id")
    if not item_id:
        return PlainTextResponse("Missing item id", status_code=400)

    channel_id = get_vault_chat_id()
    if not channel_id:
        return PlainTextResponse("Channel ID not configured", status_code=500)

    try:
        reg, _ = await get_or_create_registry()
        vault_list = reg.get("vault", [])
        matched = next((v for v in vault_list if str(v.get("id")) == str(item_id)), None)

        file_id = None
        is_video = False

        if matched and matched.get("fileId"):
            file_id = matched["fileId"]
            is_video = (matched.get("type") == "videos")
        else:
            msg = await application.bot.forward_message(
                chat_id=channel_id,
                from_chat_id=channel_id,
                message_id=int(item_id)
            )
            await application.bot.delete_message(chat_id=channel_id, message_id=msg.message_id)

            if msg.photo:
                file_id = msg.photo[-1].file_id
                is_video = False
            elif msg.video:
                file_id = msg.video.file_id
                is_video = True

        if not file_id:
            return PlainTextResponse("Media file not found", status_code=404)

        tg_file = await application.bot.get_file(file_id)
        file_bytes = await tg_file.download_as_bytearray()

        content_type = "video/mp4" if is_video else "image/jpeg"
        return Response(content=bytes(file_bytes), media_type=content_type)
    except Exception as e:
        logging.error(f"Error streaming vault media: {e}", exc_info=True)
        return PlainTextResponse(f"Error: {e}", status_code=500)


async def api_get_vault_items(request: Request):
    """Retrieves vault items from registry."""
    reg, _ = await get_or_create_registry()
    return JSONResponse({"success": True, "vault": reg.get("vault", [])})


async def api_delete_vault_item(request: Request):
    """Deletes an item from the vault registry and telegram channel."""
    try:
        data = await request.json()
        item_id = str(data.get("id"))
        channel_id = get_vault_chat_id()

        try:
            await application.bot.delete_message(chat_id=channel_id, message_id=int(item_id))
        except Exception as e:
            logging.warning(f"Could not delete channel message {item_id}: {e}")

        reg, p_id = await get_or_create_registry()
        reg["vault"] = [v for v in reg.get("vault", []) if str(v.get("id")) != item_id]
        await save_registry(reg, p_id)

        return JSONResponse({"success": True})
    except Exception as e:
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
        drop_pending_updates=False
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
            name="daily_morning_bulletin_job"
        )
        logging.info("Registered daily morning bulletin job for 09:00 AM (Asia/Manila).")

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


# ---------------------------------------------------------
# HANDLER REGISTRATIONS
# ---------------------------------------------------------
application.add_handler(CommandHandler("start", start))
application.add_handler(CommandHandler("kuyab", kuya_b_menu))
application.add_handler(CommandHandler("kuya_b", kuya_b_menu))
application.add_handler(CommandHandler("bday", command_add_birthday))
application.add_handler(CallbackQueryHandler(menu_callback_handler))

# Business Bot handler for 1-on-1 private chat integration
application.add_handler(MessageHandler(filters.UpdateType.BUSINESS_MESSAGE, handle_business_message))

register_word_game_handlers(application)

# ---------------------------------------------------------
# STARLETTE APPLICATION ROUTES
# ---------------------------------------------------------
starlette_app = Starlette(
    routes=[
        Route("/", health_check, methods=["GET", "HEAD"]),
        Route(WEBHOOK_PATH, telegram_webhook, methods=["POST"]),

        # Modular: Birthdays
        Route("/api/birthdays", api_get_birthdays, methods=["GET"]),
        Route("/api/birthdays", api_add_birthday, methods=["POST"]),
        Route("/api/birthdays/edit", api_edit_birthday, methods=["POST"]),
        Route("/api/birthdays/delete", api_delete_birthday, methods=["POST"]),
        Route("/api/birthdays/greet", api_send_birthday_greeting, methods=["POST"]),

        # Modular: Daily Logs & Habit Tracker
        Route("/api/logs", api_get_daily_logs, methods=["GET"]),
        Route("/api/logs", api_save_daily_log, methods=["POST"]),
        Route("/api/logs/delete", api_delete_daily_log, methods=["POST"]),

        # Modular: User Activity Tracking
        Route("/api/track-user", api_track_user, methods=["POST"]),
        Route("/api/users", api_get_users, methods=["GET"]),

        # Vault Media Uploads & In-App Streaming
        Route("/api/vault/items", api_get_vault_items, methods=["GET"]),
        Route("/api/vault/upload", api_upload_vault_media, methods=["POST"]),
        Route("/api/vault/media-file", api_get_vault_media_file, methods=["GET"]),
        Route("/api/vault/delete", api_delete_vault_item, methods=["POST"]),
        Route("/api/cleanup-message", api_cleanup_message, methods=["POST"]),

        # WebApp Static Assets & Mounting
        Route("/app", serve_index, methods=["GET"]),
        Route("/app/", serve_index, methods=["GET"]),
        Mount("/app", StaticFiles(directory="webapp", html=False), name="app"),
    ],
    lifespan=lifespan,
)

if __name__ == "__main__":
    uvicorn.run(starlette_app, host="0.0.0.0", port=PORT)
