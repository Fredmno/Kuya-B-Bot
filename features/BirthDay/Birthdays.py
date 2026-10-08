import os
import json
import logging
from starlette.requests import Request
from starlette.responses import JSONResponse

VAULT_BIRTHDAYS_CACHE = []

def get_vault_chat_id():
    vault_id = os.getenv("VAULT_CHANNEL_ID", "")
    if vault_id.startswith("-") or vault_id.isdigit():
        return int(vault_id)
    return vault_id

async def api_get_birthdays(request: Request):
    return JSONResponse({"success": True, "birthdays": VAULT_BIRTHDAYS_CACHE})

async def api_add_birthday(request: Request):
    global VAULT_BIRTHDAYS_CACHE
    try:
        data = await request.json()
        name = data.get("name", "").strip()
        date_str = data.get("date", "").strip()

        if not name or not date_str:
            return JSONResponse({"error": "Name and date are required"}, status_code=400)

        channel_id = get_vault_chat_id()
        if not channel_id:
            return JSONResponse({"error": "VAULT_CHANNEL_ID not set"}, status_code=500)

        metadata_json = json.dumps({"name": name, "date": date_str})
        message_text = (
            f"🎂 **BIRTHDAY ENTRY**\n"
            f"**Name:** {name}\n"
            f"**Date:** {date_str}\n\n"
            f"`#BIRTHDAY:{metadata_json}`"
        )

        from bot import application
        sent_msg = await application.bot.send_message(
            chat_id=channel_id,
            text=message_text,
            parse_mode="Markdown"
        )

        item = {
            "id": str(sent_msg.message_id),
            "name": name,
            "date": date_str
        }
        VAULT_BIRTHDAYS_CACHE.append(item)
        return JSONResponse({"success": True, "birthday": item})
    except Exception as e:
        logging.error(f"Error saving birthday to vault channel: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)

async def api_edit_birthday(request: Request):
    global VAULT_BIRTHDAYS_CACHE
    try:
        data = await request.json()
        msg_id = data.get("id")
        name = data.get("name", "").strip()
        date_str = data.get("date", "").strip()

        if not msg_id or not name or not date_str:
            return JSONResponse({"error": "Missing parameters"}, status_code=400)

        channel_id = get_vault_chat_id()
        metadata_json = json.dumps({"name": name, "date": date_str})
        new_text = (
            f"🎂 **BIRTHDAY ENTRY**\n"
            f"**Name:** {name}\n"
            f"**Date:** {date_str}\n\n"
            f"`#BIRTHDAY:{metadata_json}`"
        )

        from bot import application
        await application.bot.edit_message_text(
            chat_id=channel_id,
            message_id=int(msg_id),
            text=new_text,
            parse_mode="Markdown"
        )

        for b in VAULT_BIRTHDAYS_CACHE:
            if str(b.get("id")) == str(msg_id):
                b["name"] = name
                b["date"] = date_str
                break

        return JSONResponse({"success": True})
    except Exception as e:
        logging.error(f"Error editing birthday in vault: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)

async def api_delete_birthday(request: Request):
    global VAULT_BIRTHDAYS_CACHE
    try:
        data = await request.json()
        msg_id = data.get("id")
        if not msg_id:
            return JSONResponse({"error": "Missing birthday ID"}, status_code=400)

        channel_id = get_vault_chat_id()
        from bot import application
        try:
            await application.bot.delete_message(chat_id=channel_id, message_id=int(msg_id))
        except Exception as bot_err:
            logging.warning(f"Could not delete birthday message {msg_id}: {bot_err}")

        VAULT_BIRTHDAYS_CACHE = [b for b in VAULT_BIRTHDAYS_CACHE if str(b.get("id")) != str(msg_id)]
        return JSONResponse({"success": True})
    except Exception as e:
        logging.error(f"Error deleting birthday from vault: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)
