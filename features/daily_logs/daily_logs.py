import os
import json
import logging
from starlette.requests import Request
from starlette.responses import JSONResponse

def get_vault_chat_id():
    vault_id = os.getenv("VAULT_CHANNEL_ID", "")
    if vault_id.startswith("-") or vault_id.isdigit():
        return int(vault_id)
    return vault_id

async def api_save_daily_log(request: Request):
    try:
        data = await request.json()
        mood = data.get("mood", "😊")
        habits = data.get("habits", [])
        content = data.get("content", "").strip()
        date_str = data.get("date", "")
        time_str = data.get("time", "")

        channel_id = get_vault_chat_id()
        if not channel_id:
            return JSONResponse({"error": "VAULT_CHANNEL_ID not set"}, status_code=500)

        metadata_json = json.dumps({"mood": mood, "habits": habits, "date": date_str, "time": time_str})

        habits_formatted = ""
        if habits:
            habits_formatted = "\n\n**✅ Habits Completed:**\n" + "\n".join([f"• {h}" for h in habits])

        message_text = (
            f"📅 **DAILY LOG**\n"
            f"**Date:** {date_str} • {time_str}\n"
            f"**Mood:** {mood}"
            f"{habits_formatted}\n\n"
            f"**Notes:**\n{content if content else '_(No notes added)_'}\n\n"
            f"`#DAILY_LOG:{metadata_json}`"
        )

        from bot import application, get_or_create_registry, save_registry
        sent_msg = await application.bot.send_message(
            chat_id=channel_id,
            text=message_text,
            parse_mode="Markdown"
        )

        log_entry = {
            "id": str(sent_msg.message_id),
            "message_id": sent_msg.message_id,
            "mood": mood,
            "habits": habits,
            "content": content,
            "date": date_str,
            "time": time_str
        }

        # Persist to permanent registry
        reg, msg_id = await get_or_create_registry()
        reg_logs = reg.get("logs", [])
        reg_logs.insert(0, log_entry)
        reg["logs"] = reg_logs
        await save_registry(reg, msg_id)

        return JSONResponse({"success": True, "log": log_entry})
    except Exception as e:
        logging.error(f"Error posting daily log: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)

async def api_get_daily_logs(request: Request):
    from bot import get_or_create_registry
    reg, _ = await get_or_create_registry()
    return JSONResponse({"success": True, "logs": reg.get("logs", [])})

async def api_delete_daily_log(request: Request):
    try:
        data = await request.json()
        msg_id = data.get("id")
        if not msg_id:
            return JSONResponse({"error": "Missing message id"}, status_code=400)

        channel_id = get_vault_chat_id()
        from bot import application, get_or_create_registry, save_registry
        try:
            await application.bot.delete_message(chat_id=channel_id, message_id=int(msg_id))
        except Exception as bot_err:
            logging.warning(f"Could not delete message {msg_id}: {bot_err}")

        reg, p_msg_id = await get_or_create_registry()
        reg["logs"] = [item for item in reg.get("logs", []) if str(item.get("id")) != str(msg_id)]
        await save_registry(reg, p_msg_id)

        return JSONResponse({"success": True})
    except Exception as e:
        logging.error(f"Error deleting daily log: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)
