import os
import logging
from contextlib import asynccontextmanager

import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import PlainTextResponse, JSONResponse
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

from database import init_db
from features.word_game import register_word_game_handlers
from features.menu import kuya_b_menu

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

WEBHOOK_PATH = "/telegram"
WEBHOOK_URL = f"{RENDER_EXTERNAL_URL}{WEBHOOK_PATH}"

application = Application.builder().token(BOT_TOKEN).build()


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🤖 Kuya B is online!"
        "Use /kuya_b to open the Mini App."
        "Use /game to start Word Scramble."
    )


async def telegram_webhook(request: Request):
    data = await request.json()
    update = Update.de_json(data, application.bot)
    await application.process_update(update)
    return PlainTextResponse("OK")


async def health_check(request: Request):
    return PlainTextResponse("Kuya B Bot is running.")


@asynccontextmanager
from telegram import BotCommand, BotCommandScopeDefault

@asynccontextmanager
async def lifespan(app):
    init_db()
    init_birthday_db()

    await application.initialize()
    await application.bot.set_webhook(WEBHOOK_URL)
    
    # Register /kuyab command
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
application.add_handler(CommandHandler("kuya_b", kuya_b_menu))

# Feature modules
register_word_game_handlers(application)

# Error handler should be registered after feature handlers
application.add_error_handler(error_handler)

VAULT_CHANNEL_ID = os.getenv("VAULT_CHANNEL_ID")

async def api_forward_vault_item(request: Request):
    try:
        data = await request.json()
        raw_msg_id = data.get("messageId")
        user_id = data.get("userId")

        if not user_id:
            logging.error("Vault forward error: No user_id provided by Mini App")
            return JSONResponse({"error": "User ID is required"}, status_code=400)

        if not raw_msg_id:
            logging.error("Vault forward error: No messageId provided")
            return JSONResponse({"error": "Message ID is required"}, status_code=400)

        # Ensure channel ID is treated as int if it's numeric, or string if @channel
        vault_id = os.getenv("VAULT_CHANNEL_ID")
        if not vault_id:
            logging.error("Vault forward error: VAULT_CHANNEL_ID environment variable is missing on Render")
            return JSONResponse({"error": "VAULT_CHANNEL_ID not set"}, status_code=500)

        if vault_id.startswith("-") or vault_id.isdigit():
            from_chat_id = int(vault_id)
        else:
            from_chat_id = vault_id

        message_id = int(raw_msg_id)
        target_user = int(user_id)

        logging.info(f"Attempting to copy message {message_id} from {from_chat_id} to user {target_user}")

        await application.bot.copy_message(
            chat_id=target_user,
            from_chat_id=from_chat_id,
            message_id=message_id,
        )

        return JSONResponse({"success": True})
    except Exception as e:
        logging.error(f"Error copying message from vault: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)



starlette_app = Starlette(
    routes=[
        Route("/", health_check, methods=["GET", "HEAD"]),
        Route(WEBHOOK_PATH, telegram_webhook, methods=["POST"]),

        Route("/api/birthdays", api_get_birthdays, methods=["GET"]),
Route("/api/birthdays", api_add_birthday, methods=["POST"]),
Route("/api/birthdays/edit", api_edit_birthday, methods=["POST"]),
Route("/api/birthdays/delete", api_delete_birthday, methods=["POST"]),

        Route("/api/vault/forward", api_forward_vault_item, methods=["POST"]),


        Mount("/app", StaticFiles(directory="webapp", html=True), name="app"),
    ],
    lifespan=lifespan,
)


if __name__ == "__main__":
    uvicorn.run(starlette_app, host="0.0.0.0", port=PORT)
