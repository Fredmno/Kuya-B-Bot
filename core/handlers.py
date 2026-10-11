import os
import logging
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

logger = logging.getLogger(__name__)


async def default_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Hello! Kuya B is online.")


def register_all_handlers(application: Application, start_handler=None):
    """Registers handlers, using default_start if no handler is explicitly provided."""
    handler = start_handler or default_start
    application.add_handler(CommandHandler("start", handler))
