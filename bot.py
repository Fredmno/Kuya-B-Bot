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

# Attempt to get bot info (username and id) so we can detect mentions reliably
BOT_USERNAME = None
BOT_ID = None
try:
    r = requests.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getMe", timeout=10)
    if r.ok:
        info = r.json().get("result", {})
        BOT_USERNAME = info.get("username")
        BOT_ID = info.get("id")
    else:
        print("Warning: getMe returned non-ok response; mention detection may be less reliable.", file=sys.stderr)
except Exception as e:
    print(f"Warning: Failed to call getMe: {e}. Mention detection may be less reliable.", file=sys.stderr)

DATA_FILE = "state.json"

# Plain-text name variants we should respond to in group chats (case-insensitive)
KEYWORD_MENTIONS = ["kuyab", "kuya b", "kuya-b", "kuya_b"]

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

def message_is_from_bot(msg):
    return msg.get("from", {}).get("is_bot", False)

def bot_was_mentioned(msg):
    # Uses entities and reply-to to detect mentions reliably when we have BOT_USERNAME or BOT_ID
    text = msg.get("text", "") or ""
    if not text:
        return False

    text_lower = text.lower()

    # Check entities for mention or text_mention
    entities = msg.get("entities", []) or []
    for ent in entities:
        ent_type = ent.get("type")
        if ent_type == "mention":
            # slice the text to get the mentioned string
            offset = ent.get("offset", 0)
            length = ent.get("length", 0)
            mention = text[offset:offset+length].lower()
            if BOT_USERNAME and mention == ("@" + BOT_USERNAME.lower()):
                return True
        elif ent_type == "text_mention":
            user = ent.get("user", {})
            if BOT_ID and user.get("id") == BOT_ID:
                return True

    # Fallback: plain-text search for @username if we have it
    if BOT_USERNAME and ("@" + BOT_USERNAME.lower()) in text_lower:
        return True

    # Check if this message is a reply to a message from the bot
    reply = msg.get("reply_to_message")
    if reply and reply.get("from", {}).get("id") == BOT_ID:
        return True

    # Additional fallback: detect plain-text name mentions in group chats (e.g., "kuyab", "KuyaB", etc.)
    chat_type = msg.get("chat", {}).get("type", "")
    if chat_type not in ("private", None):
        for kw in KEYWORD_MENTIONS:
            if kw in text_lower:
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

        # ignore messages from other bots to avoid loops
        if message_is_from_bot(msg):
            continue

        chat_id = msg["chat"]["id"]
        state["chat_id"] = chat_id
        text = msg.get("text", "") or ""

        # skip bot commands
        if text.startswith("/"):
            continue

        # First try interactive replies
        handled = handle_message(text, chat_id)

        # If not handled, check whether we should echo: private DM or mentioned in group
        chat_type = msg.get("chat", {}).get("type", "")
        is_private = chat_type == "private"
        mentioned = bot_was_mentioned(msg)

        if not handled and (is_private or mentioned):
            # simple echo: send the same text back (you can change prefix if you want)
            if text.strip():
                send(chat_id, text)

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
