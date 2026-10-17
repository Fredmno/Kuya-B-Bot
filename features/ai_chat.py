import os
import logging
from anthropic import AsyncAnthropic
from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import CommandHandler, MessageHandler, ContextTypes, filters

logger = logging.getLogger(__name__)

ADMIN_CHAT_ID = os.environ.get("ADMIN_CHAT_ID", "7698531657")
MODEL = "claude-sonnet-5-5"
SYSTEM = "You are Kuya B, a friendly personal assistant. Keep replies concise. Reply in the user's language (English or Tagalog)."
MAX_MSGS = 20

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = AsyncAnthropic()  # reads ANTHROPIC_API_KEY
    return _client

async def reset_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["history"] = []
    await update.message.reply_text("Memory cleared.")

async def ai_reply(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return
    if str(update.effective_user.id) != str(ADMIN_CHAT_ID):
        return  # keep API costs on you only
    text = update.message.text
    if text.lstrip().startswith(("{", "```")):
        return  # leave commit payloads to the JSON committer

    history = context.user_data.setdefault("history", [])
    history.append({"role": "user", "content": text})
    del history[:-MAX_MSGS]
    while history and history[0]["role"] != "user":
        history.pop(0)

    await context.bot.send_chat_action(update.effective_chat.id, ChatAction.TYPING)
    try:
        resp = await _get_client().messages.create(
            model=MODEL, max_tokens=1000, system=SYSTEM, messages=history
        )
        reply = resp.content[0].text
    except Exception as e:
        history.pop()
        logger.error(f"AI error: {e}")
        await update.message.reply_text("Sorry, AI is unavailable right now.")
        return

    history.append({"role": "assistant", "content": reply})
    for i in range(0, len(reply), 4000):
        await update.message.reply_text(reply[i:i + 4000])

def get_handlers():
    return [
        CommandHandler("reset", reset_command),
        MessageHandler(filters.TEXT & ~filters.COMMAND, ai_reply),
    ]
