import os
import json
import logging
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

RENDER_EXTERNAL_URL = os.getenv("RENDER_EXTERNAL_URL", "").rstrip("/")


def get_main_menu_keyboard():
    web_app_url = f"{RENDER_EXTERNAL_URL}/app"
    keyboard = [
        [
            InlineKeyboardButton("🚀 Open", web_app={"url": web_app_url})
        ],
        [
            InlineKeyboardButton("🎂 Birthdays", callback_data="menu_birthdays"),
            InlineKeyboardButton("📅 Logs", callback_data="menu_daily_logs"),
        ],
        [
            InlineKeyboardButton("✅ Tasks", callback_data="menu_tasks"),
            InlineKeyboardButton("🎮 Play", callback_data="menu_game"),
        ],
        [
            InlineKeyboardButton("❌ Close", callback_data="menu_close"),
        ]
    ]
    return InlineKeyboardMarkup(keyboard)


async def kuya_b_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Entry point for /kuyab or /kuya_b command."""
    text = (
        "🤖 **Kuya B Personal Hub**\n\n"
        "Select a feature below to manage your vault or open the Mini App:"
    )
    if update.message:
        await update.message.reply_text(
            text=text,
            reply_markup=get_main_menu_keyboard(),
            parse_mode="Markdown"
        )


def calculate_days_until(date_str):
    """Calculates days remaining until upcoming birthday (MM-DD)."""
    try:
        parts = date_str.split("-")
        month = int(parts[0])
        day = int(parts[1])
        now = datetime.now()
        today = datetime(now.year, now.month, now.day)
        
        target = datetime(now.year, month, day)
        if target < today:
            target = datetime(now.year + 1, month, day)
            
        diff = (target - today).days
        return diff
    except Exception:
        return 999


async def render_birthdays_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Fetches birthdays from registry and edits message with list and actions."""
    query = update.callback_query
    
    from bot import get_or_create_registry
    reg, _ = await get_or_create_registry()
    birthdays = reg.get("birthdays", [])

    if not birthdays:
        bday_text = "🎂 **BIRTHDAYS LIST**\n\n_No birthdays recorded in your vault yet._"
    else:
        sorted_bdays = sorted(birthdays, key=lambda b: calculate_days_until(b.get("date", "")))
        lines = []
        for b in sorted_bdays:
            name = b.get("name", "Unknown")
            b_date = b.get("date", "MM-DD")
            days_left = calculate_days_until(b_date)
            
            if days_left == 0:
                badge = "🎉 **TODAY!**"
            elif days_left == 1:
                badge = "⏳ _Tomorrow_"
            else:
                badge = f"⏳ _In {days_left} days_"
                
            lines.append(f"• **{name}** — 📅 `{b_date}` ({badge})")
        
        bday_text = "🎂 **BIRTHDAYS LIST**\n\n" + "\n".join(lines)

    # Simplified single-word labels
    keyboard = [
        [
            InlineKeyboardButton("➕ Add", callback_data="bday_add_prompt"),
            InlineKeyboardButton("🗑️ Remove", callback_data="bday_remove_menu"),
        ],
        [
            InlineKeyboardButton("◀️ Menu", callback_data="menu_main"),
            InlineKeyboardButton("❌ Cancel", callback_data="menu_close"),
        ]
    ]

    await query.edit_message_text(
        text=bday_text,
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode="Markdown"
    )


async def render_remove_birthday_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Shows individual delete buttons for each saved birthday."""
    query = update.callback_query

    from bot import get_or_create_registry
    reg, _ = await get_or_create_registry()
    birthdays = reg.get("birthdays", [])

    if not birthdays:
        keyboard = [[InlineKeyboardButton("◀️ Back", callback_data="menu_birthdays")]]
        await query.edit_message_text(
            text="🎂 No birthdays available to remove.",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        return

    keyboard = []
    for b in birthdays:
        name = b.get("name", "Unknown")
        msg_id = str(b.get("id"))
        keyboard.append([
            InlineKeyboardButton(f"🗑️ {name}", callback_data=f"bday_del_{msg_id}")
        ])

    keyboard.append([InlineKeyboardButton("◀️ Cancel", callback_data="menu_birthdays")])

    await query.edit_message_text(
        text="🗑️ **Select a birthday to remove:**",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode="Markdown"
    )


async def menu_callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Global callback query router for chat inline buttons."""
    query = update.callback_query
    await query.answer()

    data = query.data or ""

    if data == "menu_main":
        text = (
            "🤖 **Kuya B Personal Hub**\n\n"
            "Select a feature below to manage your vault or open the Mini App:"
        )
        await query.edit_message_text(
            text=text,
            reply_markup=get_main_menu_keyboard(),
            parse_mode="Markdown"
        )

    elif data == "menu_close":
        try:
            await query.message.delete()
        except Exception:
            await query.edit_message_text("Menu closed.")

    elif data == "menu_birthdays":
        await render_birthdays_menu(update, context)

    elif data == "bday_add_prompt":
        prompt_text = (
            "➕ **To Add a Birthday:**\n\n"
            "Open the **Kuya B Hub** Mini App via the button below and tap `+` on the Birthdays page, "
            "or reply with `/bday Name MM-DD` (e.g. `/bday Maria 10-25`)."
        )
        keyboard = [
            [InlineKeyboardButton("🚀 Open", web_app={"url": f"{RENDER_EXTERNAL_URL}/app"})],
            [InlineKeyboardButton("◀️ Back", callback_data="menu_birthdays")]
        ]
        await query.edit_message_text(
            text=prompt_text,
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )

    elif data == "bday_remove_menu":
        await render_remove_birthday_menu(update, context)

    elif data.startswith("bday_del_"):
        target_id = data.replace("bday_del_", "")
        from bot import get_or_create_registry, save_registry, application, get_vault_chat_id
        
        channel_id = get_vault_chat_id()
        try:
            await application.bot.delete_message(chat_id=channel_id, message_id=int(target_id))
        except Exception as e:
            logging.warning(f"Could not delete channel message {target_id}: {e}")

        reg, p_msg_id = await get_or_create_registry()
        reg["birthdays"] = [b for b in reg.get("birthdays", []) if str(b.get("id")) != target_id]
        await save_registry(reg, p_msg_id)

        await render_birthdays_menu(update, context)

    elif data == "menu_daily_logs":
        keyboard = [
            [InlineKeyboardButton("🚀 Open", web_app={"url": f"{RENDER_EXTERNAL_URL}/app"})],
            [InlineKeyboardButton("◀️ Menu", callback_data="menu_main")]
        ]
        await query.edit_message_text(
            text="📅 **Daily Logs**\n\nTrack your mood and completed daily habits inside the Mini App:",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )

    elif data == "menu_tasks":
        keyboard = [
            [InlineKeyboardButton("🚀 Open", web_app={"url": f"{RENDER_EXTERNAL_URL}/app"})],
            [InlineKeyboardButton("◀️ Menu", callback_data="menu_main")]
        ]
        await query.edit_message_text(
            text="✅ **Tasks & Reminders**\n\nManage your checklist directly inside the Mini App:",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )

    elif data == "menu_game":
        keyboard = [[InlineKeyboardButton("◀️ Menu", callback_data="menu_main")]]
        await query.edit_message_text(
            text="🎮 To play Word Scramble, type `/game` in this chat!",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )
