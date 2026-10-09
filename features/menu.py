import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

# Modular delegation to Birthday feature
from features.BirthDay.Birthdays import render_birthdays_table


def get_main_menu_keyboard():
    keyboard = [
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
        "Select a feature below to manage your vault directly in chat:"
    )
    if update.message:
        await update.message.reply_text(
            text=text,
            reply_markup=get_main_menu_keyboard(),
            parse_mode="Markdown"
        )


async def render_birthdays_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Fetches birthdays from registry and renders the clean monochrome table via Birthdays module."""
    query = update.callback_query
    
    from bot import get_or_create_registry
    reg, _ = await get_or_create_registry()
    birthdays = reg.get("birthdays", [])

    # Delegated table formatting to Birthdays.py
    bday_text = render_birthdays_table(birthdays)

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
            "Select a feature below to manage your vault directly in chat:"
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
            "Reply in this chat using `/bday Name MM-DD`\n"
            "Example: `/bday Maria 10-25`"
        )
        keyboard = [
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
        from bot import get_or_create_registry
        reg, _ = await get_or_create_registry()
        logs = reg.get("logs", [])

        if not logs:
            log_text = "📅 **DAILY LOGS**\n\n_No logs found in your vault._"
        else:
            recent_logs = logs[:5]
            lines = []
            for l in recent_logs:
                mood = l.get("mood", "📝")
                dt = f"{l.get('date', '')} {l.get('time', '')}".strip()
                habits = l.get("habits", [])
                h_str = f" ({len(habits)} habits)" if habits else ""
                lines.append(f"• {mood} **{dt}**{h_str}")
            log_text = "📅 **RECENT LOGS**\n\n" + "\n".join(lines)

        keyboard = [
            [InlineKeyboardButton("◀️ Menu", callback_data="menu_main")]
        ]
        await query.edit_message_text(
            text=log_text,
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )

    elif data == "menu_tasks":
        keyboard = [
            [InlineKeyboardButton("◀️ Menu", callback_data="menu_main")]
        ]
        await query.edit_message_text(
            text="✅ **Tasks & Reminders**\n\nTasks can be managed directly via chat bot commands.",
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
