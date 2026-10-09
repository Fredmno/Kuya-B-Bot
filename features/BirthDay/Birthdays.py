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

async def api_get_birthdays(request: Request):
    from bot import get_or_create_registry
    reg, _ = await get_or_create_registry()
    return JSONResponse({"success": True, "birthdays": reg.get("birthdays", [])})

async def api_add_birthday(request: Request):
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

        from bot import application, get_or_create_registry, save_registry
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

        # Persist to registry
        reg, msg_id = await get_or_create_registry()
        b_list = reg.get("birthdays", [])
        b_list.append(item)
        reg["birthdays"] = b_list
        await save_registry(reg, msg_id)

        return JSONResponse({"success": True, "birthday": item})
    except Exception as e:
        logging.error(f"Error saving birthday to vault: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)

async def api_edit_birthday(request: Request):
    try:
        data = await request.json()
        msg_id = data.get("id")
        name = data.get("name", "").strip()
        date_str = data.get("date", "").strip()

        channel_id = get_vault_chat_id()
        metadata_json = json.dumps({"name": name, "date": date_str})
        new_text = (
            f"🎂 **BIRTHDAY ENTRY**\n"
            f"**Name:** {name}\n"
            f"**Date:** {date_str}\n\n"
            f"`#BIRTHDAY:{metadata_json}`"
        )

        from bot import application, get_or_create_registry, save_registry
        await application.bot.edit_message_text(
            chat_id=channel_id,
            message_id=int(msg_id),
            text=new_text,
            parse_mode="Markdown"
        )

        reg, p_msg_id = await get_or_create_registry()
        for b in reg.get("birthdays", []):
            if str(b.get("id")) == str(msg_id):
                b["name"] = name
                b["date"] = date_str
                break
        await save_registry(reg, p_msg_id)

        return JSONResponse({"success": True})
    except Exception as e:
        logging.error(f"Error editing birthday in vault: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)

async def api_delete_birthday(request: Request):
    try:
        data = await request.json()
        msg_id = data.get("id")
        if not msg_id:
            return JSONResponse({"error": "Missing birthday ID"}, status_code=400)

        channel_id = get_vault_chat_id()
        from bot import application, get_or_create_registry, save_registry
        try:
            await application.bot.delete_message(chat_id=channel_id, message_id=int(msg_id))
        except Exception as bot_err:
            logging.warning(f"Could not delete message {msg_id}: {bot_err}")

        reg, p_msg_id = await get_or_create_registry()
        reg["birthdays"] = [b for b in reg.get("birthdays", []) if str(b.get("id")) != str(msg_id)]
        await save_registry(reg, p_msg_id)

        return JSONResponse({"success": True})
    except Exception as e:
        logging.error(f"Error deleting birthday from vault: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


import os
import logging
from datetime import datetime
from telegram.ext import ContextTypes

async def check_and_send_daily_birthday_greetings(context: ContextTypes.DEFAULT_TYPE):
    group_chat_id = os.getenv("GROUP_CHAT_ID")
    if not group_chat_id:
        logging.warning("GROUP_CHAT_ID is not configured. Skipping daily greeting.")
        return

    try:
        from bot import get_or_create_registry
        reg, _ = await get_or_create_registry()
        birthdays = reg.get("birthdays", [])

        # Match MM-DD format (e.g., "10-09")
        today_str = datetime.now().strftime("%m-%d")

        celebrants = [b["name"] for b in birthdays if b.get("date") == today_str]

        if celebrants:
            names = ", ".join(celebrants)
            greeting_msg = (
                f"🎉🎂 **HAPPY BIRTHDAY TO {names.upper()}!** 🎂🎉\n\n"
                f"Wishing you a wonderful day filled with joy, good health, and blessings! 🥳✨\n\n"
                f"— *Kuya B Hub*"
            )

            await context.bot.send_message(
                chat_id=int(group_chat_id) if group_chat_id.startswith("-") or group_chat_id.isdigit() else group_chat_id,
                text=greeting_msg,
                parse_mode="Markdown"
            )
            logging.info(f"Sent automatic birthday greeting for: {names}")
    except Exception as e:
        logging.error(f"Error in automatic daily birthday check: {e}", exc_info=True)
