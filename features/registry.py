import os
import json
import logging

logger = logging.getLogger(__name__)

VAULT_CHAT_ID = os.getenv("VAULT_CHAT_ID")
REGISTRY_TAG = "#KUYA_B_REGISTRY:"


def _get_chat_id():
    cid = os.getenv("VAULT_CHAT_ID")
    if not cid:
        return None
    try:
        return int(cid.strip())
    except ValueError:
        return None


async def get_or_create_registry(bot):
    """
    Finds or creates the permanent vault registry message.
    """
    default_data = {
        "birthdays": [],
        "logs": [],
        "vault": [],
        "users": []
    }

    chat_id = _get_chat_id()
    if not chat_id:
        logger.error("VAULT_CHAT_ID is not configured or invalid in environment.")
        return None, default_data

    try:
        chat = await bot.get_chat(chat_id=chat_id)
        pinned = chat.pinned_message

        if pinned and pinned.text and REGISTRY_TAG in pinned.text:
            raw_json = pinned.text.split(REGISTRY_TAG, 1)[1].strip()
            return pinned.message_id, json.loads(raw_json)

        # If not pinned or missing, create a new one
        text = f"🗄️ KUYA B PERMANENT VAULT REGISTRY\nDO NOT DELETE\n\n{REGISTRY_TAG}{json.dumps(default_data)}"
        msg = await bot.send_message(chat_id=chat_id, text=text)
        try:
            await bot.pin_chat_message(chat_id=chat_id, message_id=msg.message_id)
        except Exception as pe:
            logger.warning(f"Could not pin registry message: {pe}")
        return msg.message_id, default_data

    except Exception as e:
        logger.error(f"Error fetching registry from Telegram: {e}", exc_info=True)
        return None, default_data


async def update_registry_data(msg_id, data, bot):
    """
    Edits the permanent vault registry message.
    """
    chat_id = _get_chat_id()
    if not chat_id:
        logger.error("update_registry_data: VAULT_CHAT_ID is not set.")
        return False

    # If msg_id was None, create a fresh message first
    if not msg_id:
        logger.warning("update_registry_data: msg_id was None. Creating new message.")
        new_msg_id, _ = await get_or_create_registry(bot)
        msg_id = new_msg_id
        if not msg_id:
            return False

    payload = f"🗄️ KUYA B PERMANENT VAULT REGISTRY\nDO NOT DELETE\n\n{REGISTRY_TAG}{json.dumps(data)}"
    try:
        await bot.edit_message_text(
            chat_id=chat_id,
            message_id=int(msg_id),
            text=payload
        )
        return True
    except Exception as e:
        logger.error(f"Telegram API error editing registry message {msg_id}: {e}", exc_info=True)
        # If the original message was deleted, try creating a fresh one
        try:
            msg = await bot.send_message(chat_id=chat_id, text=payload)
            try:
                await bot.pin_chat_message(chat_id=chat_id, message_id=msg.message_id)
            except Exception:
                pass
            return True
        except Exception as create_err:
            logger.error(f"Failed to recreate registry message: {create_err}", exc_info=True)
            return False
