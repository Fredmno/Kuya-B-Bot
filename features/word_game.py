import json
import random
from pathlib import Path

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters,
)

from database import get_player, add_xp, get_leaderboard


WORDS_FILE = Path("data/words.json")


def game_buttons():
    keyboard = [
        [
            InlineKeyboardButton("🆕 NEW", callback_data="word_game:new"),
            InlineKeyboardButton("⏭️ SKIP", callback_data="word_game:skip"),
            InlineKeyboardButton("🛑 STOP", callback_data="word_game:stop"),
        ]
    ]
    return InlineKeyboardMarkup(keyboard)


def open_menu_buttons():
    keyboard = [
        [
            InlineKeyboardButton("👤 Profile", callback_data="word_game:profile"),
            InlineKeyboardButton("🏆 Leaderboard", callback_data="word_game:leaderboard"),
        ]
    ]
    return InlineKeyboardMarkup(keyboard)


def load_words():
    if WORDS_FILE.exists():
        with open(WORDS_FILE, "r", encoding="utf-8") as file:
            return json.load(file)

    return [
        {"word": "rocket", "hint": "Space", "difficulty": "easy"},
        {"word": "telegram", "hint": "Technology", "difficulty": "medium"},
    ]


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
        pass

    context.chat_data["last_menu_message_id"] = None


async def send_new_puzzle(message, context: ContextTypes.DEFAULT_TYPE, prefix_text=None):
    chat_id = message.chat_id

    await delete_previous_game_message(context, chat_id)

    word_bank = load_words()
    selected = random.choice(word_bank)

    answer = selected["word"]
    hint = selected.get("hint", "General")

    scrambled = list(answer)
    random.shuffle(scrambled)
    scrambled_word = "".join(scrambled).upper()

    if scrambled_word == answer.upper() and len(answer) > 1:
        while scrambled_word == answer.upper():
            scrambled = list(answer)
            random.shuffle(scrambled)
            scrambled_word = "".join(scrambled).upper()

    context.chat_data["current_answer"] = answer
    context.chat_data["current_hint"] = hint
    context.chat_data["current_scrambled_word"] = scrambled_word

    intro = ""
    if prefix_text:
        intro = f"{prefix_text}\n\n"

    sent_message = await message.reply_text(
        f"{intro}"
        f"*🧩 WORD SCRAMBLE*\n\n"
        f"*Hint:* {hint}\n"
        f"```Unscramble This Word:"
        f" \n\n"
        f"{scrambled_word}\n"
        f" \n\n"
        f"```\n\n"
        f"```Rules:"
        f"• Reply to this puzzle message with your answer\n"
        f"• Correct answer: +20 XP\n"
        f"• Incorrect answer: 0 XP\n"
        f"• First correct answer wins the round\n"
        f"```",
        parse_mode="Markdown",
        reply_markup=game_buttons(),
    )

    context.chat_data["last_game_message_id"] = sent_message.message_id


async def resend_active_puzzle(message, context: ContextTypes.DEFAULT_TYPE):
    chat_id = message.chat_id

    current_answer = context.chat_data.get("current_answer")
    hint = context.chat_data.get("current_hint")
    scrambled_word = context.chat_data.get("current_scrambled_word")

    if not current_answer or not hint or not scrambled_word:
        await send_new_puzzle(message, context)
        return

    await delete_previous_game_message(context, chat_id)

    sent_message = await message.reply_text(
        f"*🧩 WORD SCRAMBLE*\n\n"
        f"_This is the active puzzle._\n\n"
        f"*Hint:* {hint}\n"
        f"```Unscramble This Word:"
        f" \n\n"
        f"{scrambled_word}\n"
        f" \n\n"
        f"```\n\n"
        f"```Rules:"
        f"• Reply to this puzzle message with your answer\n"
        f"• Correct answer: +20 XP\n"
        f"• Incorrect answer: 0 XP\n"
        f"• First correct answer wins the round\n"
        f"```",
        parse_mode="Markdown",
        reply_markup=game_buttons(),
    )

    context.chat_data["last_game_message_id"] = sent_message.message_id


async def game(update: Update, context: ContextTypes.DEFAULT_TYPE):
    current_answer = context.chat_data.get("current_answer")

    if current_answer:
        await resend_active_puzzle(update.message, context)
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
        context.chat_data["current_hint"] = None
        context.chat_data["current_scrambled_word"] = None

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


async def word_game_button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    action = query.data

    if action == "word_game:new":
        current_answer = context.chat_data.get("current_answer")

        if current_answer:
            await resend_active_puzzle(query.message, context)
            return

        await send_new_puzzle(query.message, context)

    elif action == "word_game:skip":
        current_answer = context.chat_data.get("current_answer")

        if current_answer:
            prefix_text = (
                f"⏭️ <b>Puzzle skipped.</b>\n\n"
                f"Previous answer was: <code>{current_answer.upper()}</code>"
            )
        else:
            prefix_text = "⏭️ <b>No active puzzle found.</b> Starting a new one."

        await send_new_puzzle(query.message, context, prefix_text=prefix_text)

    elif action == "word_game:stop":
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
        context.chat_data["current_hint"] = None
        context.chat_data["current_scrambled_word"] = None

        await delete_previous_game_message(context, query.message.chat_id)

        sent_message = await query.message.reply_text(
            f"🛑 <b>Puzzle stopped.</b>\n\n"
            f"The correct answer was: <code>{current_answer.upper()}</code>\n\n"
            f"Press NEW or use /game to start another puzzle.",
            parse_mode="HTML",
            reply_markup=game_buttons(),
        )

        context.chat_data["last_game_message_id"] = sent_message.message_id

    elif action == "word_game:profile":
        await send_profile_from_button(query, context)

    elif action == "word_game:leaderboard":
        await send_leaderboard_from_button(query)


def register_word_game_handlers(application):
    application.add_handler(CommandHandler("game", game))
    application.add_handler(CommandHandler("profile", profile))
    application.add_handler(CommandHandler("leaderboard", leaderboard))
    application.add_handler(CommandHandler("open", open_menu))

    application.add_handler(
        CallbackQueryHandler(
            word_game_button_handler,
            pattern="^word_game:",
        )
    )

    application.add_handler(
        MessageHandler(
            filters.TEXT & ~filters.COMMAND,
            check_answer,
        )
    )
