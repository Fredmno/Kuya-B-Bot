import os
import requests
import logging
import time
from telegram import InlineKeyboardButton, InlineKeyboardMarkup

# Set up logging
logging.basicConfig(level=logging.INFO)

# Read secrets from environment variables
BOT_TOKEN = os.environ.get("BOT_TOKEN")
CHAT_ID = os.environ.get("CHAT_ID")

def send_message(chat_id, text, reply_to=None, reply_markup=None):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML"
    }
    if reply_to:
        payload["reply_to_message_id"] = reply_to
    if reply_markup:
        # Convert reply_markup to dict for JSON serialization
        payload["reply_markup"] = reply_markup.to_dict()

    try:
        r = requests.post(url, json=payload, timeout=15)
        if r.status_code == 429:
            try:
                data = r.json()
                retry_after = int(data.get("parameters", {}).get("retry_after") or data.get("retry_after") or 1)
            except:
                retry_after = 1
            logging.warning(f"Rate limited by Telegram, sleeping {retry_after + 1}s then retrying")
            time.sleep(retry_after + 1)
            r = requests.post(url, json=payload, timeout=15)
        if not r.ok:
            logging.warning(f"Telegram sendMessage failed ({r.status_code}): {r.text}")
            return None
        return r.json().get("result")
    except:
        logging.exception("Failed to send message")
        return None

def main():
    # Example usage: send a message with inline keyboard
    if not BOT_TOKEN or not CHAT_ID:
        logging.error("BOT_TOKEN and CHAT_ID must be set in environment variables.")
        return

    text = "Hello! Choose an option:"
    keyboard = [
        [InlineKeyboardButton("Puzzle Game 🧩", callback_data='puzzle')],
        [InlineKeyboardButton("Word Game ✍️", callback_data='word')],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    send_message(CHAT_ID, text, reply_markup=reply_markup)

if __name__ == "__main__":
    main()
