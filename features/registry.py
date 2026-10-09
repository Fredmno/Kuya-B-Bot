import os
import json
import logging

VAULT_CHAT_ID = os.getenv("VAULT_CHAT_ID")
REGISTRY_TAG = "#KUYA_B_REGISTRY:"


async def get_or_create_registry(bot):
    """
    Finds or creates the permanent vault registry message.
    bot: Telegram Bot instance passed in from request or handler.
    """
    default_data = {
        "birthdays": [],
        "logs": [],
        "vault": [],
        "users": []
    }

    if not VAULT_CHAT_ID:
        logging.warning("VAULT_CHAT_ID is not configured.")
        return None, default_data

    try:
        chat = await bot.get_chat(chat_id=int(VAULT_CHAT_ID))
        pinned = chat.pinned_message

        if pinned and pinned.text and REGISTRY_TAG in pinned.text:
            raw_json = pinned.text.split(REGISTRY_TAG, 1)[1].strip()
            return pinned.message_id, json.loads(raw_json)

        text = f"🗄️ KUYA B PERMANENT VAULT REGISTRY\nDO NOT DELETE\n\n{REGISTRY_TAG}{json.dumps(default_data)}"
        msg = await bot.send_message(chat_id=int(VAULT_CHAT_ID), text=text)
        try:
            await bot.pin_chat_message(chat_id=int(VAULT_CHAT_ID), message_id=msg.message_id)
        except Exception:
            pass
        return msg.message_id, default_data

    except Exception as e:
        logging.error(f"Error fetching registry: {e}", exc_info=True)
        return None, default_data


async def update_registry_data(msg_id, data, bot):
    """
    Edits the permanent vault registry message.
    """
    if not VAULT_CHAT_ID or not msg_id:
        return False

    try:
        payload = f"🗄️ KUYA B PERMANENT VAULT REGISTRY\nDO NOT DELETE\n\n{REGISTRY_TAG}{json.dumps(data)}"
        await bot.edit_message_text(
            chat_id=int(VAULT_CHAT_ID),
            message_id=int(msg_id),
            text=payload
        )
        return True
    except Exception as e:
        logging.error(f"Error saving registry: {e}", exc_info=True)
        return False
