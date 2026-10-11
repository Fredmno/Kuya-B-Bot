import logging
from datetime import time
from zoneinfo import ZoneInfo
from contextlib import asynccontextmanager

import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import PlainTextResponse, JSONResponse

from telegram import Update, BotCommand, BotCommandScopeDefault
from telegram.ext import Application, ContextTypes

from config import APP_VERSION, BOT_TOKEN, WEBHOOK_URL, WEBHOOK_PATH, PORT
from database import init_db

# Core General Registries
from core import get_all_routes, register_all_handlers

# Background Jobs
from features.BirthDay.Birthdays import check_and_send_daily_birthday_greetings

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)

application = Application.builder().token(BOT_TOKEN).build()


# ---------------------------------------------------------
# BOT CORE ACTIONS & WEBHOOK
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
    return PlainTextResponse(f"Kuya B Bot {APP_VERSION} is operational.")


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
        await application.bot.set_my_commands(commands, scope=BotCommandScopeDefault())
    except Exception as e:
        logging.warning(f"Could not register commands: {e}")

    await application.start()
    yield
    await application.stop()
    await application.shutdown()


# ---------------------------------------------------------
# REGISTRATIONS & STARLETTE SETUP
# ---------------------------------------------------------
register_all_handlers(application, start_handler=start)

starlette_app = Starlette(
    routes=get_all_routes(
        health_check_handler=health_check,
        webhook_handler=telegram_webhook,
        cleanup_handler=api_cleanup_message,
        webhook_path=WEBHOOK_PATH,
    ),
    lifespan=lifespan,
)

if __name__ == "__main__":
    uvicorn.run(starlette_app, host="0.0.0.0", port=PORT)
