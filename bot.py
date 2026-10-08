import json
import logging
import os
import re
from starlette.requests import Request
from starlette.responses import JSONResponse

# In-memory fast cache of daily logs (reloaded from channel)
VAULT_LOGS_CACHE = []


def get_vault_chat_id():
  vault_id = os.getenv("VAULT_CHANNEL_ID", "")
  if vault_id.startswith("-") or vault_id.isdigit():
    return int(vault_id)
  return vault_id


async def api_save_daily_log(request: Request):
  try:
    data = await request.json()
    mood = data.get("mood", "😊")
    content = data.get("content", "").strip()
    date_str = data.get("date", "")
    time_str = data.get("time", "")

    channel_id = get_vault_chat_id()
    if not channel_id:
      return JSONResponse(
          {"error": "VAULT_CHANNEL_ID not set in environment"}, status_code=500
      )

    # Encode metadata into a clean footer tag so Telegram stores the structured data
    metadata_json = json.dumps(
        {"mood": mood, "date": date_str, "time": time_str}
    )

    message_text = (
        f"📅 **DAILY LOG**\n"
        f"**Date:** {date_str} • {time_str}\n"
        f"**Mood:** {mood}\n\n"
        f"{content if content else '_(No notes added)_'}\n\n"
        f"`#DAILY_LOG:{metadata_json}`"
    )

    sent_msg = await application.bot.send_message(
        chat_id=channel_id, text=message_text, parse_mode="Markdown"
    )

    log_entry = {
        "id": str(sent_msg.message_id),
        "message_id": sent_msg.message_id,
        "mood": mood,
        "content": content,
        "date": date_str,
        "time": time_str,
    }

    # Add to in-memory list
    VAULT_LOGS_CACHE.insert(0, log_entry)

    return JSONResponse({"success": True, "log": log_entry})
  except Exception as e:
    logging.error(f"Error posting daily log to vault channel: {e}", exc_info=True)
    return JSONResponse({"error": str(e)}, status_code=500)


async def api_get_daily_logs(request: Request):
  # Return cached logs directly for speed
  return JSONResponse({"success": True, "logs": VAULT_LOGS_CACHE})


async def api_delete_daily_log(request: Request):
  global VAULT_LOGS_CACHE
  try:
    data = await request.json()
    msg_id = data.get("id")
    if not msg_id:
      return JSONResponse({"error": "Missing message id"}, status_code=400)

    channel_id = get_vault_chat_id()

    # 1. Delete physical post from Telegram Vault channel
    try:
      await application.bot.delete_message(
          chat_id=channel_id, message_id=int(msg_id)
      )
    except Exception as bot_err:
      logging.warning(
          f"Message {msg_id} already deleted or not found: {bot_err}"
      )

    # 2. Remove from active cache
    VAULT_LOGS_CACHE = [
        item for item in VAULT_LOGS_CACHE if str(item.get("id")) != str(msg_id)
    ]

    return JSONResponse({"success": True})
  except Exception as e:
    logging.error(
        f"Error deleting daily log from vault channel: {e}", exc_info=True
    )
    return JSONResponse({"error": str(e)}, status_code=500)
