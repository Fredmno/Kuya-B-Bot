import os
import re
import sys
import requests
import random
import json
import time
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

# default cooldown (seconds) between replies to the same chat
COOLDOWN_SECONDS = int(os.environ.get("COOLDOWN_SECONDS", "5"))

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

# in-memory per-chat cooldown tracker
_last_reply_ts = {}


def load_state():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE) as f:
            return json.load(f)
    # Use empty string for last_flirty so it compares with YYYY-MM-DD strings below
    return {"last_update_id": 0, "last_flirty": "", "chat_id": None}


def save_state(state):
    with open(DATA_FILE, "w") as f:
        json.dump(state, f)


def _should_reply(chat_id: int) -> bool:
    """Return True and record timestamp if we are allowed to reply to this chat now."""
    now_ts = time.time()
    last = _last_reply_ts.get(chat_id, 0)
    if now_ts - last < COOLDOWN_SECONDS:
        return False
    _last_reply_ts[chat_id] = now_ts
    return True


def safe_send(chat_id, text):
    """Send a message and handle Telegram rate limits (429). Returns True on success.

    This function will respect the retry_after field returned by Telegram and retry once.
    """
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    try:
        r = requests.post(url, json=payload, timeout=10)
    except requests.RequestException:
        return False

    # Handle 429 rate limit
    if r.status_code == 429:
        try:
            data = r.json()
            retry_after = int(data.get("parameters", {}).get("retry_after") or data.get("retry_after") or 1)
        except Exception:
            retry_after = 1
        # wait and retry once
        time.sleep(retry_after + 1)
        try:
            r = requests.post(url, json=payload, timeout=10)
        except requests.RequestException:
            return False

    return r.ok


def handle_message(text, chat_id):
    """Return a reply text if an interactive reply should be sent, otherwise None.

    This avoids making network calls inside the helper so callers can check cooldowns.
    """
    text_lower = (text or "").lower()
    for keyword, replies in INTERACTIVE_REPLIES.items():
        if keyword in text_lower:
            return random.choice(replies)
    return None


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


def run_loop():
    state = load_state()
    offset = state.get("last_update_id", 0)

    # Track the day for the daily flirty message
    last_flirty_day = state.get("last_flirty", "")

    while True:
        try:
            resp = requests.get(
                f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates",
                params={"offset": offset, "timeout": 30},
                timeout=35,
            )
        except requests.RequestException:
            # network issue; back off a bit and retry
            time.sleep(2)
            continue

        if resp.status_code == 429:
            # respect Telegram's retry_after if present
            try:
                data = resp.json()
                retry_after = int(data.get("parameters", {}).get("retry_after") or data.get("retry_after") or 1)
            except Exception:
                retry_after = 1
            time.sleep(retry_after + 1)
            continue

        if not resp.ok:
            # transient error; wait and continue
            time.sleep(1)
            continue

        updates = resp.json().get("result", [])

        for update in updates:
            offset = update["update_id"] + 1
            msg = update.get("message")
            if not msg:
                continue

            # ignore messages from other bots to avoid loops
            if message_is_from_bot(msg):
                continue

            chat = msg.get("chat", {})
            chat_id = chat.get("id")
            if chat_id is None:
                continue

            # remember last chat for daily flirty fallback
            state["chat_id"] = chat_id

            text = msg.get("text", "") or ""

            # skip bot commands
            if text.startswith("/"):
                continue

            # First try interactive replies
            reply_text = handle_message(text, chat_id)

            # Determine whether to echo: private DM or mentioned in group
            chat_type = chat.get("type", "")
            is_private = chat_type == "private"
            mentioned = bot_was_mentioned(msg)

            if reply_text:
                if _should_reply(chat_id):
                    safe_send(chat_id, reply_text)
            elif text.strip() and (is_private or mentioned):
                if _should_reply(chat_id):
                    safe_send(chat_id, text)

        # persist offset and last_flirty once per loop
        state["last_update_id"] = offset

        # daily flirty message — send once per day to last seen chat
        now = datetime.now()
        today = now.strftime("%Y-%m-%d")
        if last_flirty_day != today and state.get("chat_id"):
            if _should_reply(state["chat_id"]):
                safe_send(state["chat_id"], random.choice(FLIRTY_LINES))
            last_flirty_day = today
            state["last_flirty"] = today

        save_state(state)


def main():
    run_loop()


if __name__ == "__main__":
    main()
