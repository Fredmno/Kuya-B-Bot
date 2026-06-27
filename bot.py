import os
import requests
import logging

BOT_TOKEN = os.environ.get("BOT_TOKEN")
CHAT_ID = os.environ.get("CHAT_ID")

def main():
    if not BOT_TOKEN or not CHAT_ID:
        print("BOT_TOKEN and CHAT_ID must be set")
        return
    
    # Example: send a message
    send_message(CHAT_ID, "Bot is online!")

def send_message(chat_id, text):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML"
    }
    r = requests.post(url, json=payload)
    if r.ok:
        print("Message sent")
    else:
        print("Failed to send message:", r.text)

if __name__ == "__main__":
    main()
