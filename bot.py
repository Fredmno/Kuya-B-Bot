from flask import Flask, request, jsonify, abort
import os
import re
import sys
import time
import random
import json
import logging
import requests

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Configuration
BOT_TOKEN = os.environ.get("BOT_TOKEN")
if not BOT_TOKEN:
    logging.error("Environment variable BOT_TOKEN is not set. Set BOT_TOKEN to your Telegram bot token.")
    raise SystemExit("BOT_TOKEN not set")

# Optional separate secret for the webhook path; if not set we fall back to BOT_TOKEN (less ideal)
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET") or BOT_TOKEN

# External URL (used to auto-set webhook). Set this to your Render service URL, e.g. https://kuyab-bot.onrender.com
RENDER_EXTERNAL_URL = os.environ.get("RENDER_EXTERNAL_URL")

# Basic Telegram token format check (warn-only)
if not re.match(r'^\d+:[A-Za-z0-9_-]{35,}$', BOT_TOKEN):
    logging.warning("BOT_TOKEN doesn't look like a typical Telegram token format.")

# Try to discover bot username and id for better mention detection
BOT_USERNAME = None
BOT_ID = None
try:
    r = requests.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getMe", timeout=10)
    if r.ok:
        info = r.json().get("result", {})
        BOT_USERNAME = info.get("username")
        BOT_ID = info.get("id")
        logging.info(f"Discovered bot username={BOT_USERNAME} id={BOT_ID}")
    else:
        logging.warning("getMe returned non-ok response; mention detection may be less reliable.")
except Exception as e:
    logging.warning(f"Failed to call getMe: {e}. Mention detection may be less reliable.")

# Behaviour configuration
KEYWORD_MENTIONS = ["kuyab", "kuya b", "kuya-b", "kuya_b"]
COOLDOWN_SECONDS = int(os.environ.get("COOLDOWN_SECONDS", "5"))

FLIRTY_LINES = [
    "Uy, may nag-iisip ba sakin ngayon? 👀",
    "Alam mo bang ang productive ng araw pag nakita ko username mo? 😏",
    "Hoy, miss na kita ah. Bakit di ka nagpaparamdam? 💔",
]

INTERACTIVE_REPLIES = {
    "kamusta": ["Mas lalong gumaganda/gwapo pag nakikita ko chat mo 😏", "Okay naman, mas okay siguro kung magkape tayo ☕", "Bakit? Miss mo na ba ko? 😌💕"],
    "miss": ["Miss din kita, lalo na pag tahimik ka jan 🥺", "Sabi ko na eh, alam kong may nag-iisip sakin 😏", "Totoo ba? Sige patunayan mo, chat ka palagi ha? 💖"],
    "love": ["Hala siya, nahulog na ba? 😳💕", "Love na love? Chz! Pero pag nagpatuloy to baka nga 🫣", "Grabe ka naman, napapangiti mo ko eh 😊💓"],
    "good morning": ["Good morning din, sikat ng araw ko ☀️💖", "Gising agad para ma-chat ka? Worth it naman 😏", "Morning! Pangga-good morning mo ba ko araw-araw? 🥹"],
    "good night": ["Goodnight! Pangarapin mo naman ako ha? 😴💭", "Matutulog na pero naka-ngiti kasi nakausap kita 😊🌙", "Goodnight, ingatan mo yung puso mo... akin yan eh 😌💕"],
}

# Simple in-memory cooldown tracker
_last_reply_ts = {}

DATA_FILE = "state.json"


def _should_reply(chat_id: int) -> bool:
    now_ts = time.time()
    last = _last_reply_ts.get(chat_id, 0)
    if now_ts - last < COOLDOWN_SECONDS:
        return False
    _last_reply_ts[chat_id] = now_ts
    return True


def safe_send(chat_id, text):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    try:
        r = requests.post(url, json=payload, timeout=10)
    except requests.RequestException as e:
        logging.exception("Failed to send message")
        return False

    if r.status_code == 429:
        try:
            data = r.json()
            retry_after = int(data.get("parameters", {}).get("retry_after") or data.get("retry_after") or 1)
        except Exception:
            retry_after = 1
        logging.warning(f"Rate limited by Telegram, sleeping {retry_after+1}s then retrying")
        time.sleep(retry_after + 1)
        try:
            r = requests.post(url, json=payload, timeout=10)
        except requests.RequestException:
            logging.exception("Retry failed")
            return False

    if not r.ok:
        logging.warning(f"Telegram API returned non-ok status {r.status_code}: {r.text}")
    return r.ok


def handle_message_text(text: str):
    text_lower = (text or "").lower()
    for keyword, replies in INTERACTIVE_REPLIES.items():
        if keyword in text_lower:
            return random.choice(replies)
    return None


def message_is_from_bot(msg):
    return msg.get("from", {}).get("is_bot", False)


def bot_was_mentioned(msg):
    text = msg.get("text", "") or ""
    if not text:
        return False
    text_lower = text.lower()

    entities = msg.get("entities", []) or []
    for ent in entities:
        ent_type = ent.get("type")
        if ent_type == "mention":
            offset = ent.get("offset", 0)
            length = ent.get("length", 0)
            mention = text[offset:offset+length].lower()
            if BOT_USERNAME and mention == ("@" + BOT_USERNAME.lower()):
                return True
        elif ent_type == "text_mention":
            user = ent.get("user", {})
            if BOT_ID and user.get("id") == BOT_ID:
                return True

    if BOT_USERNAME and ("@" + BOT_USERNAME.lower()) in text_lower:
        return True

    reply = msg.get("reply_to_message")
    if reply and reply.get("from", {}).get("id") == BOT_ID:
        return True

    chat_type = msg.get("chat", {}).get("type", "")
    if chat_type not in ("private", None):
        for kw in KEYWORD_MENTIONS:
            if kw in text_lower:
                return True

    return False


def set_webhook_if_requested():
    if not RENDER_EXTERNAL_URL:
        logging.info("RENDER_EXTERNAL_URL not set; skipping auto setWebhook")
        return
    webhook_url = RENDER_EXTERNAL_URL.rstrip('/') + f"/webhook/{WEBHOOK_SECRET}"
    try:
        r = requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/setWebhook", data={"url": webhook_url}, timeout=10)
        if r.ok and r.json().get('ok'):
            logging.info(f"Successfully set webhook to {webhook_url}")
        else:
            logging.warning(f"Failed to set webhook: {r.status_code} {r.text}")
    except Exception:
        logging.exception("Exception while setting webhook")


@app.route("/", methods=["GET"])
def health():
    return "OK", 200


@app.route(f"/webhook/<token>", methods=["POST"])
def webhook(token):
    if token != WEBHOOK_SECRET:
        logging.warning("Received webhook with invalid token")
        return "invalid token", 403

    update = request.get_json(force=True, silent=True)
    if not update:
        return jsonify({"ok": False, "error": "no json"}), 400

    msg = update.get("message") or update.get("edited_message") or update.get("channel_post") or update.get("edited_channel_post")
    if not msg:
        return jsonify({"ok": True})

    try:
        if message_is_from_bot(msg):
            return jsonify({"ok": True})

        chat = msg.get("chat", {})
        chat_id = chat.get("id")
        if chat_id is None:
            return jsonify({"ok": True})

        text = msg.get("text") or msg.get("caption") or ""

        if text and text.startswith("/"):
            return jsonify({"ok": True})

        reply_text = handle_message_text(text)
        chat_type = chat.get("type", "")
        is_private = chat_type == "private"
        mentioned = bot_was_mentioned(msg)

        if reply_text:
            if _should_reply(chat_id):
                safe_send(chat_id, reply_text)
        elif text.strip() and (is_private or mentioned):
            if _should_reply(chat_id):
                safe_send(chat_id, text)

    except Exception:
        logging.exception("Error handling update")

    return jsonify({"ok": True})


if __name__ == "__main__":
    # Try to set webhook automatically if RENDER_EXTERNAL_URL is provided
    set_webhook_if_requested()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
