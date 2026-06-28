import os

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ContextTypes


async def kuya_b_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    render_url = os.getenv("RENDER_EXTERNAL_URL")

    if not render_url:
        await update.message.reply_text(
            "Mini App URL is not configured. Please check RENDER_EXTERNAL_URL."
        )
        return

    mini_app_url = f"{render_url}/app/"

    keyboard = [
        [
            InlineKeyboardButton(
                "🚀 Open Mini App",
                web_app=WebAppInfo(url=mini_app_url),
            )
        ]
    ]

    await update.message.reply_text(
        "🤖 <b>Kuya B</b>",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )