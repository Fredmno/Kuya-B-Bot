import os
import logging
from contextlib import asynccontextmanager
import random

import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import PlainTextResponse
from starlette.routing import Route

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters,
)

from database import init_db, get_player, add_xp, get_leaderboard


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


def game_buttons():
    keyboard = [
        [
            InlineKeyboardButton("NEW", callback_data="new_game"),
            InlineKeyboardButton("SKIP", callback_data="skip_game"),
            InlineKeyboardButton("STOP", callback_data="stop_game"),
        ]
    ]

    return InlineKeyboardMarkup(keyboard)


async def delete_previous_game_message(context: ContextTypes.DEFAULT_TYPE, chat_id):
    last_message_id = context.chat_data.get("last_game_message_id")

    if not last_message_id:
        return

    try:
        await context.bot.delete_message(
            chat_id=chat_id,
            message_id=last_message_id,
        )
    except Exception:
        pass

    context.chat_data["last_game_message_id"] = None


async def send_new_puzzle(message, context: ContextTypes.DEFAULT_TYPE, prefix_text=None):
    chat_id = message.chat_id

    await delete_previous_game_message(context, chat_id)

    words = ["apple", "banana", "orange", "puzzle", "python", "telegram", "quest"]

    answer = random.choice(words)
    scrambled = list(answer)
    random.shuffle(scrambled)
    scrambled_word = "".join(scrambled)

    context.chat_data["current_answer"] = answer

    intro = ""

    if prefix_text:
        intro = f"{prefix_text}\n\n"

    sent_message = await message.reply_text(
        f"{intro}"
        f"🧩 Word Scramble\n\n"
        f"Unscramble this word:\n\n"
        f"`{scrambled_word}`\n\n"
        f"First correct answer gets +20 XP!",
        parse_mode="Markdown",
        reply_markup=game_buttons(),
    )

    context.chat_data["last_game_message_id"] = sent_message.message_id


async def game(update: Update, context: ContextTypes.DEFAULT_TYPE):
    current_answer = context.chat_data.get("current_answer")

    if current_answer:
        await update.message.reply_text(
            "⚠️ A game is already active.\n\n"
            "Solve it, skip it, or stop it first.",
            reply_markup=game_buttons(),
        )
        return

    await send_new_puzzle(update.message, context)


async def check_answer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    current_answer = context.chat_data.get("current_answer")

    if not current_answer:
        return

    user_answer = update.message.text.strip().lower()

    if user_answer == current_answer.lower():
        user = update.effective_user
        user_id = str(user.id)
        username = user.username or ""
        user_name = user.first_name or "Player"

        result = add_xp(user_id, username, user_name, 20)

        context.chat_data["current_answer"] = None

        await delete_previous_game_message(context, update.message.chat_id)

        await update.message.reply_text(
            f"✅ Correct, {user_name}!\n\n"
            f"The answer was: {current_answer}\n"
            f"+20 XP\n\n"
            f"Total XP: {result['xp']}\n"
            f"Level: {result['level']}\n"
            f"Wins: {result['wins']}"
        )


async def profile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    user_id = str(user.id)
    username = user.username or ""
    user_name = user.first_name or "Player"

    player = get_player(user_id, username, user_name)

    xp = player["xp"]
    wins = player["wins"]
    level = (xp // 100) + 1

    await update.message.reply_text(
        f"👤 Player Profile\n\n"
        f"Name: {player['name']}\n"
        f"Username: @{player['username'] if player['username'] else 'N/A'}\n"
        f"XP: {xp}\n"
        f"Level: {level}\n"
        f"Wins: {wins}"
    )


async def leaderboard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    players = get_leaderboard(10)

    if not players:
        await update.message.reply_text(
            "🏆 WordQuest Leaderboard\n\n"
            "No players yet. Use /game to start earning XP."
        )
        return

    message = "🏆 WordQuest Leaderboard\n\n"

    for index, player in enumerate(players, start=1):
        xp = player["xp"]
        wins = player["wins"]
        level = (xp // 100) + 1
        name = player["name"] or "Player"

        message += (
            f"{index}. {name} — "
            f"{xp} XP | Lv {level} | {wins} wins\n"
        )

    await update.message.reply_text(message)


async def open_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [
            InlineKeyboardButton("👤 Profile", callback_data="menu_profile"),
            InlineKeyboardButton("🏆 Leaderboard", callback_data="menu_leaderboard"),
        ]
    ]

    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        "🎮 WordQuest Menu\n\n"
        "Choose an option:",
        reply_markup=reply_markup,
    )


async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    action = query.data

    if action == "new_game":
        current_answer = context.chat_data.get("current_answer")

        if current_answer:
            await query.message.reply_text(
                "⚠️ A game is already active.\n\n"
                "Solve it, skip it, or stop it first.",
                reply_markup=game_buttons(),
            )
            return

        await send_new_puzzle(query.message, context)

    elif action == "skip_game":
        current_answer = context.chat_data.get("current_answer")

        if current_answer:
            prefix_text = f"⏭️ Puzzle skipped.\n\nPrevious answer was: {current_answer}"
        else:
            prefix_text = "⏭️ No active puzzle found. Starting a new one."

        await send_new_puzzle(query.message, context, prefix_text=prefix_text)

    elif action == "stop_game":
        current_answer = context.chat_data.get("current_answer")

        if not current_answer:
            await query.message.reply_text(
                "⚠️ No active puzzle right now.\n\n"
                "Press NEW or use /game to start one.",
                reply_markup=game_buttons(),
            )
            return

        context.chat_data["current_answer"] = None

        await delete_previous_game_message(context, query.message.chat_id)

        sent_message = await query.message.reply_text(
            f"🛑 Puzzle stopped.\n\n"
            f"The correct answer was: {current_answer}\n\n"
            f"Press NEW or use /game to start another puzzle.",
            reply_markup=game_buttons(),
        )

        context.chat_data["last_game_message_id"] = sent_message.message_id

    elif action == "menu_profile":
        user = query.from_user
        user_id = str(user.id)
        username = user.username or ""
        user_name = user.first_name or "Player"

        player = get_player(user_id, username, user_name)

        xp = player["xp"]
        wins = player["wins"]
        level = (xp // 100) + 1

        await query.message.reply_text(
            f"👤 Player Profile\n\n"
            f"Name: {player['name']}\n"
            f"Username: @{player['username'] if player['username'] else 'N/A'}\n"
            f"XP: {xp}\n"
            f"Level: {level}\n"
            f"Wins: {wins}"
        )

    elif action == "menu_leaderboard":
        players = get_leaderboard(10)

        if not players:
            await query.message.reply_text(
                "🏆 WordQuest Leaderboard\n\n"
                "No players yet. Use /game to start earning XP."
            )
            return

        message = "🏆 WordQuest Leaderboard\n\n"

        for index, player in enumerate(players, start=1):
            xp = player["xp"]
            wins = player["wins"]
            level = (xp // 100) + 1
            name = player["name"] or "Player"

            message += (
                f"{index}. {name} — "
                f"{xp} XP | Lv {level} | {wins} wins\n"
            )

        await query.message.reply_text(message)


async def telegram_webhook(request: Request):
    data = await request.json()
    update = Update.de_json(data, application.bot)
    await application.process_update(update)
    return PlainTextResponse("OK")


async def health_check(request: Request):
    return PlainTextResponse("WordQuest Bot is running.")


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


application.add_handler(CommandHandler("start", start))
application.add_handler(CommandHandler("game", game))
application.add_handler(CommandHandler("profile", profile))
application.add_handler(CommandHandler("leaderboard", leaderboard))
application.add_handler(CommandHandler("open", open_menu))

application.add_handler(CallbackQueryHandler(button_handler))
application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, check_answer))

application.add_error_handler(error_handler)


starlette_app = Starlette(
    routes=[
        Route("/", health_check, methods=["GET"]),
        Route(WEBHOOK_PATH, telegram_webhook, methods=["POST"]),
    ],
    lifespan=lifespan,
)


if __name__ == "__main__":
    uvicorn.run(starlette_app, host="0.0.0.0", port=PORT)
