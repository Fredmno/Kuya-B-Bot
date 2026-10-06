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
            InlineKeyboardButton("📁 Vault", callback_data="open_other"),
            InlineKeyboardButton("🎮 Word Game", callback_data="open_game"),
        ],
        [
            InlineKeyboardButton("🔙 Back", callback_data="menu_back"),
            InlineKeyboardButton("❌ Close", callback_data="menu_close"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


# Command: /kuyab or /kuya_b
async def kuya_b_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    chat = update.effective_chat

    welcome_text = (
        f"🤖 **Kuya B is online!**\n\n"
        f"Kumusta, {user.first_name}! Tap **Menu** below to explore your personal hub, "
        "or **Close** to dismiss this panel."
    )

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
    chat_id = query.message.chat_id
    message_id = query.message.message_id

    # 1. Close: Dismiss the panel cleanly
    if data == "menu_close":
        try:
            await query.message.delete()
        except Exception:
            await query.edit_message_text("🙏 Kuya B panel closed. Use /kuyab anytime.")
        return

    # 2. Back: Return to initial welcome screen
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

    # 3. Open Features Menu
    if data == "menu_open":
        instructions = (
            "📋 **Kuya B — Main Menu**\n\n"
            "Select an option below to open that tool directly inside your Mini App:\n\n"
            "• 🎂 **Birthdays** — Dates & upcoming alerts\n"
            "• 📅 **Daily Logs** — Quick notes & moods\n"
            "• ✅ **Tasks** — To-do lists & priorities\n"
            "• ⏰ **Reminders** — Timed notifications\n"
            "• 🎥 **Videos** — Channel video vault\n"
            "• 🖼️ **Pictures** — Channel photo vault\n"
            "• 📁 **Vault** — Documents & other files\n"
            "• 🎮 **Word Game** — Play Word Scramble"
        )
        await query.edit_message_text(
            text=instructions,
            reply_markup=get_features_keyboard(),
            parse_mode="Markdown",
        )
        return

    # 4. Feature Selection: Launch button with deep-link and cleanup query params
    feature_map = {
        "open_birthdays": ("🎂 Birthdays", "birthdays"),
        "open_daily": ("📅 Daily Logs", "daily"),
        "open_tasks": ("✅ Tasks", "tasks"),
        "open_reminders": ("⏰ Reminders", "reminders"),
        "open_videos": ("🎥 Videos", "videos"),
        "open_pictures": ("🖼️ Pictures", "pictures"),
        "open_other": ("📁 Vault", "other"),
    }

    if data in feature_map:
        label, section = feature_map[data]
        launch_url = f"{WEBAPP_BASE_URL}?start={section}&msg_id={message_id}&chat_id={chat_id}"

        btn_keyboard = InlineKeyboardMarkup(
            [
                [InlineKeyboardButton(f"🚀 Open {label}", web_app=WebAppInfo(url=launch_url))],
                [
                    InlineKeyboardButton("🔙 Menu", callback_data="menu_open"),
                    InlineKeyboardButton("❌ Close", callback_data="menu_close"),
                ],
            ]
        )
        await query.edit_message_text(
            text=f"Opening **{label}** directly.\nTap below to launch:",
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
