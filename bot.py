import os
import logging
import random
import yt_dlp
import uvicorn

from contextlib import asynccontextmanager
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
        "🧩 WordQuest Bot is online!\n\n"
        "Use /game to start a puzzle.\n"
        "Use /open to view your profile and leaderboard."
    )


def game_buttons():
    keyboard = [
        [
            InlineKeyboardButton("🆕 NEW", callback_data="new_game"),
            InlineKeyboardButton("⏭️ SKIP", callback_data="skip_game"),
            InlineKeyboardButton("🛑 STOP", callback_data="stop_game"),
        ]
    ]
    return InlineKeyboardMarkup(keyboard)


def open_menu_buttons():
    keyboard = [
        [
            InlineKeyboardButton("👤 Profile", callback_data="menu_profile"),
            InlineKeyboardButton("🏆 Leaderboard", callback_data="menu_leaderboard"),
        ]
    ]
    return InlineKeyboardMarkup(keyboard)


async def download(update: Update, context: ContextTypes.DEFAULT_TYPE):
    url = update.message.text.strip()

    if not url.startswith("http"):
        await update.message.reply_text("Send me a video URL.")
        return

    await update.message.reply_text("Downloading...")

    ydl_opts = {
        "outtmpl": "downloads/%(title)s.%(ext)s",
        "format": "mp4/best",
        "noplaylist": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)

        await update.message.reply_video(video=open(filename, "rb"))

        os.remove(filename)

    except Exception as e:
        await update.message.reply_text(str(e))


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
        # Ignore if the message was already deleted or cannot be deleted.
        pass

    context.chat_data["last_game_message_id"] = None


async def delete_previous_menu_message(context: ContextTypes.DEFAULT_TYPE, chat_id):
    last_menu_message_id = context.chat_data.get("last_menu_message_id")

    if not last_menu_message_id:
        return

    try:
        await context.bot.delete_message(
            chat_id=chat_id,
            message_id=last_menu_message_id,
        )
    except Exception:
        # Ignore if the message was already deleted or cannot be deleted.
        pass

    context.chat_data["last_menu_message_id"] = None


async def send_new_puzzle(message, context: ContextTypes.DEFAULT_TYPE, prefix_text=None):
    chat_id = message.chat_id

    await delete_previous_game_message(context, chat_id)

    word_bank = [
        {"word": "apple", "hint": "Food"},
        {"word": "banana", "hint": "Food"},
        {"word": "orange", "hint": "Food"},
        {"word": "coffee", "hint": "Food"},
        {"word": "puzzle", "hint": "Game"},
        {"word": "quest", "hint": "Adventure"},
        {"word": "castle", "hint": "Place"},
        {"word": "island", "hint": "Place"},
        {"word": "dragon", "hint": "Fantasy"},
        {"word": "wizard", "hint": "Fantasy"},
        {"word": "planet", "hint": "Space"},
        {"word": "rocket", "hint": "Space"},
        {"word": "python", "hint": "Technology"},
        {"word": "telegram", "hint": "Technology"},
        {"word": "server", "hint": "Technology"},
    ]

    selected = random.choice(word_bank)
    answer = selected["word"]
    hint = selected["hint"]

    scrambled = list(answer)
    random.shuffle(scrambled)
    scrambled_word = "".join(scrambled).upper()

    # Avoid showing the original word after shuffle.
    if scrambled_word == answer.upper() and len(answer) > 1:
        while scrambled_word == answer.upper():
            scrambled = list(answer)
            random.shuffle(scrambled)
            scrambled_word = "".join(scrambled).upper()

    context.chat_data["current_answer"] = answer

    intro = ""
    if prefix_text:
        intro = f"{prefix_text}\n\n"

    sent_message = await message.reply_text(
        f"{intro}"
        f"\n"
        f"🧩 <b>WORD SCRAMBLE</b>\n"
        f"\n\n"
        f"<b>Hint: </b>{hint}\n\n"
        f"```Unscramble this word:\n"
        f"<pre>{scrambled_word}</pre>\n"
        f"```\n\n"
        f"<pre>```Rules:\n"
        f"• Reply to this puzzle message with your answer\n"
        f"• Correct answer: +20 XP\n"
        f"• Incorrect answer: 0 XP\n"
        f"• First correct answer wins the round\n"
        f"```</pre>",
        parse_mode="HTML",
        reply_markup=game_buttons(),
    )

    context.chat_data["last_game_message_id"] = sent_message.message_id


async def game(update: Update, context: ContextTypes.DEFAULT_TYPE):
    current_answer = context.chat_data.get("current_answer")

    if current_answer:
        await update.message.reply_text(
            "⚠️ <b>A game is already active.</b>\n\n"
            "Solve it, skip it, or stop it first.",
            parse_mode="HTML",
            reply_markup=game_buttons(),
        )
        return

    await send_new_puzzle(update.message, context)


async def check_answer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    current_answer = context.chat_data.get("current_answer")

    if not current_answer:
        return

    last_game_message_id = context.chat_data.get("last_game_message_id")

    if not update.message.reply_to_message:
        return

    if update.message.reply_to_message.message_id != last_game_message_id:
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
            f"✅ <b>Correct, {user_name}!</b>\n\n"
            f"The answer was: <code>{current_answer.upper()}</code>\n"
            f"+20 XP\n\n"
            f"Total XP: {result['xp']}\n"
            f"Level: {result['level']}\n"
            f"Wins: {result['wins']}",
            parse_mode="HTML",
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
        f"👤 <b>Player Profile</b>\n\n"
        f"Name: {player['name']}\n"
        f"Username: @{player['username'] if player['username'] else 'N/A'}\n"
        f"XP: {xp}\n"
        f"Level: {level}\n"
        f"Wins: {wins}",
        parse_mode="HTML",
    )


async def leaderboard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    players = get_leaderboard(10)

    if not players:
        await update.message.reply_text(
            "🏆 <b>WordQuest Leaderboard</b>\n\n"
            "No players yet. Use /game to start earning XP.",
            parse_mode="HTML",
        )
        return

    message = "🏆 <b>WordQuest Leaderboard</b>\n\n"

    for index, player in enumerate(players, start=1):
        xp = player["xp"]
        wins = player["wins"]
        level = (xp // 100) + 1
        name = player["name"] or "Player"

        message += (
            f"{index}. {name} — "
            f"{xp} XP | Lv {level} | {wins} wins\n"
        )

    await update.message.reply_text(message, parse_mode="HTML")


async def open_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await delete_previous_menu_message(context, update.message.chat_id)

    sent_message = await update.message.reply_text(
        "🎮 <b>WordQuest Menu</b>\n\n"
        "Choose an option:",
        parse_mode="HTML",
        reply_markup=open_menu_buttons(),
    )

    context.chat_data["last_menu_message_id"] = sent_message.message_id


async def send_profile_from_button(query, context: ContextTypes.DEFAULT_TYPE):
    user = query.from_user
    user_id = str(user.id)
    username = user.username or ""
    user_name = user.first_name or "Player"

    player = get_player(user_id, username, user_name)

    xp = player["xp"]
    wins = player["wins"]
    level = (xp // 100) + 1

    await query.message.reply_text(
        f"👤 <b>Player Profile</b>\n\n"
        f"Name: {player['name']}\n"
        f"Username: @{player['username'] if player['username'] else 'N/A'}\n"
        f"XP: {xp}\n"
        f"Level: {level}\n"
        f"Wins: {wins}",
        parse_mode="HTML",
    )


async def send_leaderboard_from_button(query):
    players = get_leaderboard(10)

    if not players:
        await query.message.reply_text(
            "🏆 <b>WordQuest Leaderboard</b>\n\n"
            "No players yet. Use /game to start earning XP.",
            parse_mode="HTML",
        )
        return

    message = "🏆 <b>WordQuest Leaderboard</b>\n\n"

    for index, player in enumerate(players, start=1):
        xp = player["xp"]
        wins = player["wins"]
        level = (xp // 100) + 1
        name = player["name"] or "Player"

        message += (
            f"{index}. {name} — "
            f"{xp} XP | Lv {level} | {wins} wins\n"
        )

    await query.message.reply_text(message, parse_mode="HTML")


async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    action = query.data

    if action == "new_game":
        current_answer = context.chat_data.get("current_answer")

        if current_answer:
            await query.message.reply_text(
                "⚠️ <b>A game is already active.</b>\n\n"
                "Solve it, skip it, or stop it first.",
                parse_mode="HTML",
                reply_markup=game_buttons(),
            )
            return

        await send_new_puzzle(query.message, context)

    elif action == "skip_game":
        current_answer = context.chat_data.get("current_answer")

        if current_answer:
            prefix_text = (
                f"⏭️ <b>Puzzle skipped.</b>\n\n"
                f"Previous answer was: <code>{current_answer.upper()}</code>"
            )
        else:
            prefix_text = "⏭️ <b>No active puzzle found.</b> Starting a new one."

        await send_new_puzzle(query.message, context, prefix_text=prefix_text)

    elif action == "stop_game":
        current_answer = context.chat_data.get("current_answer")

        if not current_answer:
            await query.message.reply_text(
                "⚠️ <b>No active puzzle right now.</b>\n\n"
                "Press NEW or use /game to start one.",
                parse_mode="HTML",
                reply_markup=game_buttons(),
            )
            return

        context.chat_data["current_answer"] = None

        await delete_previous_game_message(context, query.message.chat_id)

        sent_message = await query.message.reply_text(
            f"🛑 <b>Puzzle stopped.</b>\n\n"
            f"The correct answer was: <code>{current_answer.upper()}</code>\n\n"
            f"Press NEW or use /game to start another puzzle.",
            parse_mode="HTML",
            reply_markup=game_buttons(),
        )

        context.chat_data["last_game_message_id"] = sent_message.message_id

    elif action == "menu_profile":
        await send_profile_from_button(query, context)

    elif action == "menu_leaderboard":
        await send_leaderboard_from_button(query)


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

application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, download))
application.run_polling()


starlette_app = Starlette(
    routes=[
        Route("/", health_check, methods=["GET", "HEAD"]),
        Route(WEBHOOK_PATH, telegram_webhook, methods=["POST"]),
    ],
    lifespan=lifespan,
)


if __name__ == "__main__":
    uvicorn.run(starlette_app, host="0.0.0.0", port=PORT)
