import logging
from telegram import Update
from telegram.ext import ContextTypes

async def handle_business_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles 1-on-1 private messages sent to your personal account via Telegram Business."""
    msg = update.business_message
    if not msg or not msg.text:
        return

    connection_id = update.business_connection_id

    reply_text = (
        "👋 Hi! I received your message. I'm currently away or busy, "
        "but I'll get back to you shortly.\n\n"
        "— *Kuya B Auto-Assistant*"
    )

    try:
        await context.bot.send_message(
            chat_id=msg.chat_id,
            text=reply_text,
            business_connection_id=connection_id,
            parse_mode="Markdown"
        )
        logging.info(f"Replied to business message from chat {msg.chat_id}")
    except Exception as e:
        logging.error(f"Failed to send business message reply: {e}", exc_info=True)

