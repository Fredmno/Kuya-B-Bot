import os
import json
import logging
from anthropic import AsyncAnthropic
from telegram import Update
from telegram.constants import ChatAction
from telegram.error import BadRequest
from telegram.ext import CommandHandler, MessageHandler, ContextTypes, filters

logger = logging.getLogger(__name__)

ADMIN_CHAT_ID = os.environ.get("ADMIN_CHAT_ID", "7698531657")
MEM_CHANNEL = os.environ.get("AI_MEMORY_CHANNEL_ID") or os.environ.get("VAULT_CHANNEL_ID")
MODEL = "claude-sonnet-5-5"
SYSTEM = "You are Kuya B, a friendly personal assistant. Keep replies concise. Reply in the user's language (English or Tagalog)."
TAG = "#KUYA_AI_MEMORY\n"
MAX_CHARS = 3800   # Telegram message limit is 4096
MAX_STORED = 1200  # per-message cap in memory

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = AsyncAnthropic()
    return _client

def _dump(history):
    return TAG + json.dumps(history, ensure_ascii=False)

async def load_memory(bot, store: dict):
    if "history" in store:
        return store["history"]
    history = []
    try:
        chat = await bot.get_chat(MEM_CHANNEL)
        pm = chat.pinned_message
        if pm and pm.text and pm.text.startswith(TAG):
            store["mem_msg_id"] = pm.message_id
            history = json.loads(pm.text[len(TAG):])
    except Exception as e:
        logger.warning(f"Could not load AI memory: {e}")
    store["history"] = history
    return history

async def save_memory(bot, store: dict):
    history = store["history"]
    while len(_dump(history)) > MAX_CHARS and len(history) > 1:
        history.pop(0)
    while history and history[0]["role"] != "user":
        history.pop(0)
    text = _dump(history)
    try:
        mid = store.get("mem_msg_id")
        if mid:
            await bot.edit_message_text(chat_id=MEM_CHANNEL, message_id=mid, text=text)
        else:
            m = await bot.send_message(MEM_CHANNEL, text)
            await bot.pin_chat_message(MEM_CHANNEL, m.message_id, disable_notification=True)
            store["mem_msg_id"] = m.message_id
    except BadRequest as e:
        if "not modified" not in str(e).lower():
            logger.error(f"Memory save failed: {e}")
    except Exception as e:
        logger.error(f"Memory save failed: {e}")

async def reset_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if str(update.effective_user.id) != str(ADMIN_CHAT_ID):
        return
    store = context.application.bot_data
    await load_memory(context.bot, store)
    store["history"] = []
    await save_memory(context.bot, store)
    await update.message.reply_text("Memory cleared.")

async def ai_reply(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return
    if str(update.effective_user.id) != str(ADMIN_CHAT_ID):
        return
    text = update.message.text
    if text.lstrip().startswith(("{", "```")):
        return  # JSON committer payloads

    store = context.application.bot_data
    history = await load_memory(context.bot, store)
    history.append({"role": "user", "content": text[:MAX_STORED]})

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

    history.append({"role": "assistant", "content": reply[:MAX_STORED]})
    await save_memory(context.bot, store)
    for i in range(0, len(reply), 4000):
        await update.message.reply_text(reply[i:i + 4000])

def get_handlers():
    return [
        CommandHandler("reset", reset_command),
        MessageHandler(filters.TEXT & ~filters.COMMAND, ai_reply),
    ]
