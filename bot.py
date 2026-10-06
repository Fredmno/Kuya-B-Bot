import os
import time
import logging
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

from features.BirthDay.bday_database import init_birthday_db
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

BOT_TOKEN = os.getenv("BOT_TOKEN")
RENDER_EXTERNAL_URL = os.getenv("RENDER_EXTERNAL_URL")
PORT = int(os.getenv("PORT", 10000))
VAULT_CHANNEL_ID = os.getenv("VAULT_CHANNEL_ID")

WEBHOOK_PATH = "/telegram"
WEBHOOK_URL = f"{RENDER_EXTERNAL_URL}{WEBHOOK_PATH}"

application = Application.builder().token(BOT_TOKEN).build()


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🤖 Kuya B is online!\n"
        "Use /kuyab to open the menu.\n"
        "Use /game to start Word Scramble."
    )


async def telegram_webhook(request: Request):
    data = await request.json()
    update = Update.de_json(data, application.bot)
    await application.process_update(update)
    return PlainTextResponse("OK")


async def health_check(request: Request):
    return PlainTextResponse("Kuya B Bot is running.")


async def serve_index(request: Request):
    index_path = os.path.join("webapp", "index.html")
    if not os.path.exists(index_path):
        return PlainTextResponse("index.html not found", status_code=404)

    with open(index_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Injects live unix timestamp for auto cache-busting
    rendered = content.replace("{{ v }}", str(int(time.time())))

    headers = {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
    }
    return HTMLResponse(rendered, headers=headers)


async def api_forward_vault_item(request: Request):
    try:
        data = await request.json()
        raw_msg_id = data.get("messageId")
        user_id = data.get("userId")

        if not user_id:
            return JSONResponse({"error": "User ID is required"}, status_code=400)
        if not raw_msg_id:
            return JSONResponse({"error": "Message ID is required"}, status_code=400)

        vault_id = os.getenv("VAULT_CHANNEL_ID")
        if not vault_id:
            return JSONResponse({"error": "VAULT_CHANNEL_ID not set"}, status_code=500)

        from_chat_id = int(vault_id) if (vault_id.startswith("-") or vault_id.isdigit()) else vault_id

        await application.bot.copy_message(
            chat_id=int(user_id),
            from_chat_id=from_chat_id,
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
                message_id=int(msg_id)
            )
        return JSONResponse({"success": True})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=200)


async def api_send_birthday_greeting(request: Request):
    try:
        data = await request.json()
        chat_id = data.get("chat_id")
        name = data.get("name", "Someone special")

        if not chat_id:
            return JSONResponse({"error": "No chat_id provided"}, status_code=400)

        greeting_text = (
            f"🎉🎂 **Happy Birthday, {name}!** 🎂🎉\n\n"
            "Wishing you good health, happiness, and more blessings ahead! "
            "Let's celebrate! 🥳✨\n\n"
            "— *Kuya B Hub*"
        )

        await application.bot.send_message(
            chat_id=int(chat_id),
            text=greeting_text,
            parse_mode="Markdown"
        )
        return JSONResponse({"success": True})
    except Exception as e:
        logging.error(f"Error sending birthday greeting: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


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
        logging.warning(f"Could not set commands: {e}")

    await application.start()

    yield

    await application.stop()
    await application.shutdown()


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE):
    logging.exception("Exception while handling an update:", exc_info=context.error)


# Base commands
application.add_handler(CommandHandler("start", start))
application.add_handler(CommandHandler("kuyab", kuya_b_menu))
application.add_handler(CommandHandler("kuya_b", kuya_b_menu))

# Interactive button router
application.add_handler(CallbackQueryHandler(menu_callback_handler))

# Feature modules
register_word_game_handlers(application)

# Error handler
application.add_error_handler(error_handler)


starlette_app = Starlette(
    routes=[
        Route("/", health_check, methods=["GET", "HEAD"]),
        Route(WEBHOOK_PATH, telegram_webhook, methods=["POST"]),
        Route("/api/birthdays", api_get_birthdays, methods=["GET"]),
        Route("/api/birthdays", api_add_birthday, methods=["POST"]),
        Route("/api/birthdays/edit", api_edit_birthday, methods=["POST"]),
        Route("/api/birthdays/delete", api_delete_birthday, methods=["POST"]),
        Route("/api/birthdays/greet", api_send_birthday_greeting, methods=["POST"]),
        Route("/api/vault/forward", api_forward_vault_item, methods=["POST"]),
        Route("/api/cleanup-message", api_cleanup_message, methods=["POST"]),
        Route("/app", serve_index, methods=["GET"]),
        Route("/app/", serve_index, methods=["GET"]),
        Mount("/app/static", StaticFiles(directory="webapp"), name="static"),
    ],
    lifespan=lifespan,
)


if __name__ == "__main__":
    uvicorn.run(starlette_app, host="0.0.0.0", port=PORT)
