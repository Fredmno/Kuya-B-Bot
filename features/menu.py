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

# =========================================================
# MODULAR FEATURE REGISTRY
# Add, reorder, or update features here without touching routing
# =========================================================
FEATURE_REGISTRY = [
    {"id": "birthdays", "label": "🎂 Birthdays", "desc": "Important dates & alerts"},
    {"id": "daily", "label": "📅 Daily Logs", "desc": "Quick notes & thoughts"},
    {"id": "tasks", "label": "✅ Tasks", "desc": "To-do lists & priorities"},
    {"id": "reminders", "label": "⏰ Reminders", "desc": "Timed notifications"},
    {"id": "videos", "label": "🎥 Videos", "desc": "Channel video vault"},
    {"id": "pictures", "label": "🖼️ Pictures", "desc": "Channel photo vault"},
    {"id": "other", "label": "📁 Vault", "desc": "Documents & other files"},
]


def build_welcome_keyboard():
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📋 Menu", callback_data="menu_open"),
            InlineKeyboardButton("❌ Close", callback_data="menu_close"),
        ]
    ])


def build_features_keyboard():
    keyboard = []
    # Auto-generate 2-column grid from registry
    for i in range(0, len(FEATURE_REGISTRY), 2):
        row = [InlineKeyboardButton(FEATURE_REGISTRY[i]["label"], callback_data=f"open_{FEATURE_REGISTRY[i]['id']}")]
        if i + 1 < len(FEATURE_REGISTRY):
            row.append(InlineKeyboardButton(FEATURE_REGISTRY[i + 1]["label"], callback_data=f"open_{FEATURE_REGISTRY[i + 1]['id']}"))
        keyboard.append(row)

    # Word game & utilities
    keyboard.append([InlineKeyboardButton("🎮 Word Game", callback_data="open_game")])
    keyboard.append([
        InlineKeyboardButton("🔙 Back", callback_data="menu_back"),
        InlineKeyboardButton("❌ Close", callback_data="menu_close"),
    ])
    return InlineKeyboardMarkup(keyboard)


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
        reply_markup=build_welcome_keyboard(),
        parse_mode="Markdown",
    )


async def menu_callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    data = query.data
    chat_id = query.message.chat_id
    message_id = query.message.message_id

    if data == "menu_close":
        try:
            await query.message.delete()
        except Exception:
            await query.edit_message_text("🙏 Kuya B panel closed. Use /kuyab anytime.")
        return

    if data == "menu_back":
        user = update.effective_user
        welcome_text = (
            f"🤖 **Kuya B is online!**\n\n"
            f"Kumusta, {user.first_name}! Tap **Menu** below to explore your tools, "
            "or **Close** to dismiss."
        )
        await query.edit_message_text(
            text=welcome_text,
            reply_markup=build_welcome_keyboard(),
            parse_mode="Markdown",
        )
        return

    if data == "menu_open":
        lines = ["📋 **Kuya B — Main Menu**\n\nSelect a tool to open directly inside your Mini App:\n"]
        for feat in FEATURE_REGISTRY:
            lines.append(f"• **{feat['label']}** — {feat['desc']}")
        lines.append("• **🎮 Word Game** — Play Word Scramble")

        await query.edit_message_text(
            text="\n".join(lines),
            reply_markup=build_features_keyboard(),
            parse_mode="Markdown",
        )
        return

    # Dynamic Launch Generator matching any registered feature
    for feat in FEATURE_REGISTRY:
        if data == f"open_{feat['id']}":
            feature_id = feat["id"]
            label = feat["label"]
            launch_url = f"{WEBAPP_BASE_URL}?start={feature_id}&msg_id={message_id}&chat_id={chat_id}#start={feature_id}"

            btn_keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton(f"🚀 Open {label}", web_app=WebAppInfo(url=launch_url))],
                [
                    InlineKeyboardButton("🔙 Menu", callback_data="menu_open"),
                    InlineKeyboardButton("❌ Close", callback_data="menu_close"),
                ],
            ])
            await query.edit_message_text(
                text=f"Opening **{label}** directly.\nTap below to launch:",
                reply_markup=btn_keyboard,
                parse_mode="Markdown",
            )
            return

    if data == "open_game":
        game_keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("🔙 Menu", callback_data="menu_open"),
                InlineKeyboardButton("❌ Close", callback_data="menu_close"),
            ]
        ])
        await query.edit_message_text(
            text="🎮 Use `/game` in chat to start playing Word Scramble!",
            reply_markup=game_keyboard,
            parse_mode="Markdown",
        )
