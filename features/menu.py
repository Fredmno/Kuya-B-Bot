import os
import logging
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    WebAppInfo,
)
from telegram.ext import ContextTypes

RENDER_EXTERNAL_URL = os.getenv("RENDER_EXTERNAL_URL", "").rstrip("/")
WEBAPP_BASE_URL = f"{RENDER_EXTERNAL_URL}/app"


def get_welcome_keyboard():
    keyboard = [
        [
            InlineKeyboardButton("📋 Menu", callback_data="menu_open"),
            InlineKeyboardButton("❌ Close", callback_data="menu_close"),
        ]
    ]
    return InlineKeyboardMarkup(keyboard)


def get_features_keyboard():
    keyboard = [
        [
            InlineKeyboardButton("🎂 Birthdays", callback_data="open_birthdays"),
            InlineKeyboardButton("📅 Daily Logs", callback_data="open_daily"),
        ],
        [
            InlineKeyboardButton("✅ Tasks", callback_data="open_tasks"),
            InlineKeyboardButton("⏰ Reminders", callback_data="open_reminders"),
        ],
        [
            InlineKeyboardButton("🎥 Videos", callback_data="open_videos"),
            InlineKeyboardButton("🖼️ Pictures", callback_data="open_pictures"),
        ],
        [
            InlineKeyboardButton("📚 Vault", callback_data="open_other"),
            InlineKeyboardButton("🎮 Word Game", callback_data="open_game"),
        ],
        [
            InlineKeyboardButton("🔙 Back", callback_data="menu_back"),
            InlineKeyboardButton("❌ Close", callback_data="menu_close"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


# Command: /kuyab
async def kuya_b_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    chat = update.effective_chat

    welcome_text = (
        f"🤖 **Kuya B is online!**\n\n"
        f"Kumusta, {user.first_name}! Tap **Menu** below to explore your personal hub, "
        "or **Close** to dismiss this panel."
    )

    # In group/supergroup contexts, delete the user's triggering command if permissions allow
    if chat.type in ["group", "supergroup"]:
        try:
            await update.message.delete()
        except Exception:
            pass

    await context.bot.send_message(
        chat_id=chat.id,
        text=welcome_text,
        reply_markup=get_welcome_keyboard(),
        parse_mode="Markdown",
    )


# Callback Query Handler
async def menu_callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    data = query.data

    # 1. Close: Dismiss the entire ephemeral box
    if data == "menu_close":
        try:
            await query.message.delete()
        except Exception:
            await query.edit_message_text("🙏 Kuya B panel closed. Use /kuyab anytime.")
        return

    # 2. Back: Return to greeting
    if data == "menu_back":
        user = update.effective_user
        welcome_text = (
            f"🤖 **Kuya B is online!**\n\n"
            f"Kumusta, {user.first_name}! Tap **Menu** below to explore your tools, "
            "or **Close** to dismiss."
        )
        await query.edit_message_text(
            text=welcome_text,
            reply_markup=get_welcome_keyboard(),
            parse_mode="Markdown",
        )
        return

    # 3. Open Main Menu
    if data == "menu_open":
        instructions = (
            "📋 **Kuya B — Main Menu**\n\n"
            "Select an option to launch that specific tool in your Mini App:\n\n"
            "• 🎂 **Birthdays** — Dates & upcoming alerts\n"
            "• 📅 **Daily Logs** — Quick notes & moods\n"
            "• ✅ **Tasks** — To-do lists & priorities\n"
            "• ⏰ **Reminders** — Timed notifications\n"
            "• 🎥 / 🖼️ / 📚 **Media Vault** — Files in Telegram folders\n"
            "• 🎮 **Word Game** — Word Scramble"
        )
        await query.edit_message_text(
            text=instructions,
            reply_markup=get_features_keyboard(),
            parse_mode="Markdown",
        )
        return

    # 4. Feature Selection: Present the WebApp launcher button
    feature_map = {
        "open_birthdays": ("🎂 Birthdays", f"{WEBAPP_BASE_URL}?start=birthdays"),
        "open_daily": ("📅 Daily Logs", f"{WEBAPP_BASE_URL}?start=daily"),
        "open_tasks": ("✅ Tasks", f"{WEBAPP_BASE_URL}?start=tasks"),
        "open_reminders": ("⏰ Reminders", f"{WEBAPP_BASE_URL}?start=reminders"),
        "open_videos": ("🎥 Videos", f"{WEBAPP_BASE_URL}?start=videos"),
        "open_pictures": ("🖼️ Pictures", f"{WEBAPP_BASE_URL}?start=pictures"),
        "open_other": ("📚 Other Vault", f"{WEBAPP_BASE_URL}?start=other"),
    }

    if data in feature_map:
        label, url = feature_map[data]
        btn_keyboard = InlineKeyboardMarkup(
            [
                [InlineKeyboardButton(f"🚀 Open {label}", web_app=WebAppInfo(url=url))],
                [
                    InlineKeyboardButton("🔙 Menu", callback_data="menu_open"),
                    InlineKeyboardButton("❌ Close", callback_data="menu_close"),
                ],
            ]
        )
        await query.edit_message_text(
            text=f"Ready to launch **{label}**!\nTap the button below to open your hub:",
            reply_markup=btn_keyboard,
            parse_mode="Markdown",
        )
        return

    if data == "open_game":
        game_keyboard = InlineKeyboardMarkup(
            [
                [
                    InlineKeyboardButton("🔙 Menu", callback_data="menu_open"),
                    InlineKeyboardButton("❌ Close", callback_data="menu_close"),
                ]
            ]
        )
        await query.edit_message_text(
            text="🎮 Use `/game` in chat to start playing Word Scramble!",
            reply_markup=game_keyboard,
            parse_mode="Markdown",
        )
