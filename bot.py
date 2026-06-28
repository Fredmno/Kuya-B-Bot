import os
import logging
from contextlib import asynccontextmanager

import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import PlainTextResponse
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

from database import init_db
from features.word_game import register_word_game_handlers
from features.menu import kuya_b_menu


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
async def lifespan(app):
    init_db()

    await application.initialize()
    await application.bot.set_webhook(WEBHOOK_URL)
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


starlette_app = Starlette(
    routes=[
        Route("/", health_check, methods=["GET", "HEAD"]),
        Route(WEBHOOK_PATH, telegram_webhook, methods=["POST"]),
        Mount("/app", StaticFiles(directory="webapp", html=True), name="app"),
    ],
    lifespan=lifespan,
)


if __name__ == "__main__":
    uvicorn.run(starlette_app, host="0.0.0.0", port=PORT)
