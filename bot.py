import os
import re
import sys
import requests
import random
import json
from datetime import datetime

# Load token safely and validate basic format
BOT_TOKEN = os.environ.get("BOT_TOKEN")
if not BOT_TOKEN:
    raise SystemExit("Environment variable BOT_TOKEN is not set. Set BOT_TOKEN to your Telegram bot token.")

# Basic Telegram token format check (e.g. 123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ...)
if not re.match(r'^\d+:[A-Za-z0-9_-]{35,}$', BOT_TOKEN):
    # Warn but continue — some tokens vary in length, so exit only if you prefer strictness
    print("Warning: BOT_TOKEN doesn't look like a typical Telegram token.", file=sys.stderr)

# Optional: verify token works at startup (uncomment if you want an early runtime check)
# try:
#     r = requests.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getMe", timeout=10)
#     if not r.ok or not r.json().get("ok"):
#         raise SystemExit("BOT_TOKEN appears invalid: Telegram API returned an error.")
# except Exception as e:
#     raise SystemExit(f"Failed to validate BOT_TOKEN with Telegram API: {e}")

DATA_FILE = "state.json"

FLIRTY_LINES = [
    "Uy, may nag-iisip ba sakin ngayon? 👀",
    "Alam mo bang ang productive ng araw pag nakita ko username mo? 😏",
    "Hoy, miss na kita ah. Bakit di ka nagpaparamdam? 💔",
    "Random thought: bagay tayo. Chz... o hindi? 🤭",
    "Good morning sa taong tumatak sa isip ko pagkagising ☀️💕",
    "Ang init ng panahon pero mas mainit pag nakatanggap ako ng reply mo 🔥",
    "May gusto lang akong sabihin... nagtype nagdelete nagtype ulit... hayst ikaw na 😅",
    "Sabi ng puso ko, i-message kita. Sumusunod lang ako 😌💖",
    "Kumain ka na ba? Kasi ako, iniisip pa lang kita busog na ako 🥹💕",
    "Sarap mong kausap kahit mag-isa lang ako dito nagte-type 😔✌️",
    "Gising pa ba yung maganda/gwapo? Kasi ang puso ko gising na gising para sayo 💓",
    "May bago akong na-discover... yung ngiti mo. Nakakahawa eh 😁💫",
    "Nag-aabang lang ng reply mo parang nag-aabang ng sweldo 🥲💰",
    "Kung ang bawat chat mo ay barya, mayaman na ako ngayon 💸💕",
    "HAHAHAHA charot lang... o baka hindi? 😏🤔",
]

INTERACTIVE_REPLIES = {
    "kamusta": ["Mas lalong gumaganda/gwapo pag nakikita ko chat mo 😏", "Okay naman, mas okay siguro kung magkape tayo ☕", "Bakit? Miss mo na ba ko? 😌💕"],
    "miss": ["Miss din kita, lalo na pag tahimik ka jan 🥺", "Sabi ko na eh, alam kong may nag-iisip sakin 😏", "Totoo ba? Sige patunayan mo, chat ka palagi ha? 💖"],
    "love": ["Hala siya, nahulog na ba? 😳💕", "Love na love? Chz! Pero pag nagpatuloy to baka nga 🫣", "Grabe ka naman, napapangiti mo ko eh 😊💓"],
    "good morning": ["Good morning din, sikat ng araw ko ☀️💖", "Gising agad para ma-chat ka? Worth it naman 😏", "Morning! Pangga-good morning mo ba ko araw-araw? 🥹"],
    "good night": ["Goodnight! Pangarapin mo naman ako ha? 😴💭", "Matutulog na pero naka-ngiti kasi nakausap kita 😊🌙", "Goodnight, ingatan mo yung puso mo... akin yan eh 😌💕"],
    "gwapo": ["Alam ko naman, pero salamat sa reminder 😏🔥", "Oh edi wow, napansin mo rin sa wakas! 🤭", "Sige na, alam ko namang totoo yan HAHAHA 😎💫"],
    "ganda": ["Naku, mapapa-blush ako jan 🥰", "Kung nakikita mo lang itsura ko ngayon, naka-smile ako dahil sayo 💖", "Ang totoo, ikaw yung maganda/gwapo dito, nagpapa-cute lang ako 😏"],
}

def load_state():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE) as f:
            return json.load(f)
    # Use empty string for last_flirty so it compares with YYYY-MM-DD strings below
    return {"last_update_id": 0, "last_flirty": "", "chat_id": None}

def save_state(state):
    with open(DATA_FILE, "w") as f:
        json.dump(state, f)

def send(chat_id, text):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    try:
        requests.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"}, timeout=10)
    except Exception:
        pass

def handle_message(text, chat_id):
    text_lower = text.lower()
    for keyword, replies in INTERACTIVE_REPLIES.items():
        if keyword in text_lower:
            send(chat_id, random.choice(replies))
            return True
    return False

def main():
    state = load_state()
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates"

    resp = requests.get(url, params={"offset": state["last_update_id"], "timeout": 30}, timeout=35)
    updates = resp.json().get("result", [])

    for update in updates:
        state["last_update_id"] = update["update_id"] + 1
        msg = update.get("message")
        if not msg:
            continue
        chat_id = msg["chat"]["id"]
        state["chat_id"] = chat_id
        text = msg.get("text", "")
        if text.startswith("/"):
            continue
        handle_message(text, chat_id)

    # Send flirty message every day (check if sent today)
    now = datetime.now()
    today = now.strftime("%Y-%m-%d")
    last_flirty = state.get("last_flirty", "")

    if last_flirty != today and state.get("chat_id"):
        send(state["chat_id"], random.choice(FLIRTY_LINES))
        state["last_flirty"] = today

    save_state(state)

if __name__ == "__main__":
    main()
