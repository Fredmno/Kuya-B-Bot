import os
import logging
from contextlib import asynccontextmanager

import random
import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import PlainTextResponse
from starlette.routing import Route

from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters


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
        "🧩 WordQuest Bot is online!\n\nUse /game to start a puzzle."
    )


### GAME FUNCTION - SCRAMBLED LETTERS ###
###--------------------------------------------------------------------------------------------------
async def game(update: Update, context: ContextTypes.DEFAULT_TYPE):
    words = ["apple", "banana", "orange", "puzzle", "python", "telegram", "quest"]

    answer = random.choice(words)
    scrambled = list(answer)
    random.shuffle(scrambled)
    scrambled_word = "".join(scrambled)

    context.chat_data["current_answer"] = answer

    await update.message.reply_text(
        f"🧩 Word Scramble\n\n"
        f"Unscramble this word:\n\n"
        f"`{scrambled_word}`\n\n"
        f"First correct answer gets +20 XP!",
        parse_mode="Markdown",
    )

async def check_answer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    current_answer = context.chat_data.get("current_answer")

    if not current_answer:
        return

    user_answer = update.message.text.strip().lower()

    if user_answer == current_answer.lower():
        user = update.effective_user
        user_id = str(user.id)
        user_name = user.first_name

        players = context.chat_data.get("players", {})

        if user_id not in players:
            players[user_id] = {
                "name": user_name,
                "xp": 0,
                "wins": 0,
            }

        players[user_id]["name"] = user_name
        players[user_id]["xp"] += 20
        players[user_id]["wins"] += 1

        total_xp = players[user_id]["xp"]
        level = (total_xp // 100) + 1

        context.chat_data["players"] = players
        context.chat_data["current_answer"] = None

        await update.message.reply_text(
            f"✅ Correct, {user_name}!\n\n"
            f"The answer was: {current_answer}\n"
            f"+20 XP\n\n"
            f"Total XP: {total_xp}\n"
            f"Level: {level}"
        )


### GAME FUNCTION - USERS PROFILE COMMAN ###
###--------------------------------------------------------------------------------------------------
async def profile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    user_id = str(user.id)
    user_name = user.first_name

    players = context.chat_data.get("players", {})

    if user_id not in players:
        await update.message.reply_text(
            f"👤 Player Profile\n\n"
            f"Name: {user_name}\n"
            f"XP: 0\n"
            f"Level: 1\n"
            f"Wins: 0\n\n"
            f"Play /game to start earning XP."
        )
        return

    player = players[user_id]
    xp = player["xp"]
    wins = player["wins"]
    level = (xp // 100) + 1

    await update.message.reply_text(
        f"👤 Player Profile\n\n"
        f"Name: {player['name']}\n"
        f"XP: {xp}\n"
        f"Level: {level}\n"
        f"Wins: {wins}"
    )

async def telegram_webhook(request: Request):
    data = await request.json()
    update = Update.de_json(data, application.bot)
    await application.process_update(update)
    return PlainTextResponse("OK")


async def health_check(request: Request):
    return PlainTextResponse("WordQuest Bot is running.")


@asynccontextmanager
async def lifespan(app):
    await application.initialize()
    await application.bot.set_webhook(WEBHOOK_URL)
    await application.start()

    yield

    await application.stop()
    await application.shutdown()


application.add_handler(CommandHandler("start", start))
application.add_handler(CommandHandler("game", game))
application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, check_answer))


starlette_app = Starlette(
    routes=[
        Route("/", health_check, methods=["GET"]),
        Route(WEBHOOK_PATH, telegram_webhook, methods=["POST"]),
    ],
    lifespan=lifespan,
)


if __name__ == "__main__":
    uvicorn.run(starlette_app, host="0.0.0.0", port=PORT)
