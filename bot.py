from flask import Flask, request, jsonify, abort
import os
import re
import sys
import time
import random
import json
import logging
import requests
import threading
import uuid
from datetime import datetime, timezone

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Configuration
BOT_TOKEN = os.environ.get("BOT_TOKEN")
if not BOT_TOKEN:
    logging.error("Environment variable BOT_TOKEN is not set. Set BOT_TOKEN to your Telegram bot token.")
    raise SystemExit("BOT_TOKEN not set")

# Optional separate secret for the webhook path; if not set we fall back to BOT_TOKEN (less ideal)
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET") or BOT_TOKEN

# Agent config: external agent URL + secret (optional). If AGENT_URL not set, use internal free agent.
AGENT_URL = os.environ.get("AGENT_URL")
AGENT_SECRET = os.environ.get("AGENT_SECRET") or WEBHOOK_SECRET

# External URL (used to auto-set webhook). Set this to your Render service URL, e.g. https://kuyab-bot.onrender.com
RENDER_EXTERNAL_URL = os.environ.get("RENDER_EXTERNAL_URL")

# Bot-to-Bot Integration: TeleClaw Bot (@claw)
TELECLAW_BOT_CHAT_ID = int(os.environ.get("TELECLAW_BOT_CHAT_ID", "-4384703317"))
GROUP_CHAT_ID = int(os.environ.get("GROUP_CHAT_ID", "-2607400749"))

# Behaviour configuration
# whole-word regex for "kuya b" variants
KEYWORD_PATTERN = re.compile(r"\bkuya[-_ ]?b\b", flags=re.IGNORECASE)
COOLDOWN_SECONDS = int(os.environ.get("COOLDOWN_SECONDS", "5"))
TASK_TTL_SECONDS = int(os.environ.get("TASK_TTL_SECONDS", "1200"))  # 20 minutes default

FLIRTY_LINES = [
    "Uy, may nag-iisip ba sakin ngayon? 👀",
    "Alam ko bang ang productive ng araw pag nakita ko username mo? 😏",
    "Hoy, miss na kita ah. Bakit di ka nagpaparamdam? 💔",
]

INTERACTIVE_REPLIES = {
    "kamusta": ["Mas lalong gumaganda/gwapo pag nakikita ko chat mo 😏", "Okay naman, mas okay siguro kung magkape tayo ☕", "Bakit? Miss mo na ba ko? 😌💕"],
    "miss": ["Miss din kita, lalo na pag tahimik ka jan 🥺", "Sabi ko na eh, alam kong may nag-iisip sakin 😏", "Totoo ba? Sige patunayan mo, chat ka palagi ha? 💖"],
    "love": ["Hala siya, nahulog na ba? 😳💕", "Love na love? Chz! Pero pag nagpatuloy to baka nga 🫣", "Grabe ka naman, napapangiti mo ko eh 😊💓"],
    "good morning": ["Good morning din, sikat ng araw ko ☀️💖", "Gising agad para ma-chat ka? Worth it naman 😏", "Morning! Pangga-good morning mo ba ko araw-araw? 🥹"],
    "good night": ["Goodnight! Pangarapin mo naman ako ha? 😴💭", "Matutulog na pero naka-ngiti kasi nakausap kita 😊🌙", "Goodnight, ingatan mo yung puso mo... akin yan eh 😌💕"],
}

# State file and lock for thread-safety
DATA_FILE = "state.json"
_state_lock = threading.Lock()

# In-memory cooldown tracker (per process)
_last_reply_ts = {}


def load_state():
    with _state_lock:
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, "r") as f:
                    state = json.load(f)
            except Exception:
                logging.exception("Failed to read state file, starting fresh")
                state = {}
        else:
            state = {}

        # Ensure expected keys
        if "tasks" not in state:
            state["tasks"] = {}
        if "conversations" not in state:
            state["conversations"] = {}
        if "last_flirty" not in state:
            state["last_flirty"] = ""
        if "teleclaw_pending" not in state:
            state["teleclaw_pending"] = {}

        # Cleanup expired tasks
        now_ts = int(time.time())
        expired = []
        for tid, meta in list(state["tasks"].items()):
            created = meta.get("created_at", 0)
            if created and now_ts - created > TASK_TTL_SECONDS:
                expired.append(tid)
        for tid in expired:
            logging.info(f"Cleaning up expired task {tid}")
            state["tasks"].pop(tid, None)

        return state


def save_state(state):
    # atomic write
    tmp = DATA_FILE + ".tmp"
    with _state_lock:
        try:
            with open(tmp, "w") as f:
                json.dump(state, f)
            os.replace(tmp, DATA_FILE)
        except Exception:
            logging.exception("Failed to save state")
            try:
                if os.path.exists(tmp):
                    os.remove(tmp)
            except Exception:
                pass


def _should_reply(chat_id: int) -> bool:
    now_ts = time.time()
    last = _last_reply_ts.get(chat_id, 0)
    if now_ts - last < COOLDOWN_SECONDS:
        return False
    _last_reply_ts[chat_id] = now_ts
    return True


def send_action(chat_id, action="typing"):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendChatAction"
    try:
        requests.post(url, json={"chat_id": chat_id, "action": action}, timeout=5)
    except Exception:
        pass


def send_message(chat_id, text, reply_to=None):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_to:
        payload["reply_to_message_id"] = reply_to
    try:
        r = requests.post(url, json=payload, timeout=10)
        if r.status_code == 429:
            try:
                data = r.json()
                retry_after = int(data.get("parameters", {}).get("retry_after") or data.get("retry_after") or 1)
            except Exception:
                retry_after = 1
            logging.warning(f"Rate limited by Telegram, sleeping {retry_after+1}s then retrying")
            time.sleep(retry_after + 1)
            r = requests.post(url, json=payload, timeout=10)
        if not r.ok:
            logging.warning(f"Telegram sendMessage failed ({r.status_code}): {r.text}")
            return None
        return r.json().get("result")
    except Exception:
        logging.exception("Failed to send message")
        return None


def send_message_to_teleclaw(text: str, original_user: str) -> str:
    """Send message to TeleClaw bot (fire and forget, non-blocking)"""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    # Format message to indicate where it came from
    formatted_text = f"<b>From {original_user}:</b>\n{text}"
    payload = {"chat_id": TELECLAW_BOT_CHAT_ID, "text": formatted_text, "parse_mode": "HTML"}
    try:
        r = requests.post(url, json=payload, timeout=10)
        if r.ok:
            msg_data = r.json().get("result", {})
            message_id = msg_data.get("message_id")
            logging.info(f"Sent message to TeleClaw bot (msg_id: {message_id}) from user: {original_user}")
            
            # Track this pending request
            state = load_state()
            state["teleclaw_pending"][str(message_id)] = {
                "original_user": original_user,
                "created_at": int(time.time()),
            }
            save_state(state)
            
            return str(message_id)
        else:
            logging.warning(f"Failed to send to TeleClaw: {r.status_code} {r.text}")
            return None
    except Exception:
        logging.exception("Failed to send message to TeleClaw")
        return None


def handle_message_text(text: str):
    text_lower = (text or "").lower()
    for keyword, replies in INTERACTIVE_REPLIES.items():
        if keyword in text_lower:
            return random.choice(replies)
    return None


def message_is_from_bot(msg):
    return msg.get("from", {}).get("is_bot", False)


def is_from_teleclaw_bot(msg):
    """Check if message is from TeleClaw bot (@claw)"""
    from_user = msg.get("from", {})
    # Check if it's a bot and matches TeleClaw
    if from_user.get("is_bot"):
        username = from_user.get("username", "").lower()
        if "claw" in username or username == "claw":
            return True
    return False


def keyword_mentioned(msg):
    """Check if 'kuya b' keyword is mentioned in message"""
    text = msg.get("text", "") or ""
    if not text:
        return False
    
    # use whole-word regex for kuyab variants
    if KEYWORD_PATTERN.search(text):
        return True
    
    return False


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

    # use whole-word regex for kuyab variants
    if KEYWORD_PATTERN.search(text):
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


# ---------------- Agent/task handling ----------------

def process_message(message):
    # Called from webhook when incoming message should be forwarded to agent
    chat = message.get("chat", {})
    chat_id = chat.get("id")
    if chat_id is None:
        return

    message_id = message.get("message_id")
    sender = message.get("from", {})
    sender_name = sender.get("first_name") or sender.get("username") or "User"
    text = message.get("text") or message.get("caption") or ""
    clean = (text or "").strip()

    state = load_state()

    # Ensure conversation exists
    convo = state["conversations"].get(str(chat_id), {"history": []})
    # Append user message to conversation
    convo["history"].append({"role": "user", "text": clean, "from": sender_name, "ts": int(time.time())})
    state["conversations"][str(chat_id)] = convo

    # Save state early
    save_state(state)

    # Create task
    task_id = str(uuid.uuid4())
    task_meta = {"chat_id": chat_id, "message_id": message_id, "created_at": int(time.time()), "text": clean}
    state = load_state()
    state["tasks"][task_id] = task_meta
    save_state(state)
    logging.info(f"Created task {task_id} for chat {chat_id}")

    # Try external agent if configured (non-blocking)
    def call_external_task(tid, payload):
        headers = {"Content-Type": "application/json"}
        if AGENT_SECRET:
            headers["Authorization"] = f"Bearer {AGENT_SECRET}"
        try:
            resp = requests.post(AGENT_URL, json=payload, headers=headers, timeout=10)
            if resp.ok:
                data = resp.json()
                reply = data.get("reply")
                if reply:
                    # deliver reply via callback handler logic (reuse internal callback)
                    deliver_agent_reply(tid, reply)
                    return True
        except Exception:
            logging.exception("External agent call failed")
        return False

    def task_worker():
        payload = {
            "task_id": task_id,
            "chat_id": chat_id,
            "sender_name": sender_name,
            "conversation": convo,
            "text": clean,
            "callback_url": None,
        }

        # If AGENT_URL is set try calling external agent
        if AGENT_URL:
            logging.info(f"Posting task {task_id} to external agent")
            ok = call_external_task(task_id, payload)
            if ok:
                # external agent handled it
                state = load_state()
                state["tasks"].pop(task_id, None)
                save_state(state)
                return
            logging.info("External agent failed or returned no reply; falling back to internal agent")

        # Internal agent processing (free)
        send_action(chat_id)
        reply = None

        # Handle commands locally
        if clean.lower() == "/start":
            reply = f"Uy {sender_name}! Ako si Kuya B — group bot! I-message mo lang ako o i-mention sa group, sasagot ako agad! 🤖💪"
        elif clean.lower() in ("/help", "/commands"):
            reply = (
                f"Kuya B Commands\n"
                f"• /start — Simula\n"
                f"• /help — Tulong to\n"
                f"• /forget — Kalimutan usapan\n"
                f"• /stats — Stats ng convo\n\n"
                f"DM or mention me lang!"
            )
        elif clean.lower() == "/forget":
            state = load_state()
            state["conversations"][str(chat_id)] = {"history": []}
            save_state(state)
            reply = f"Sige {sender_name}, nakalimutan ko na usapan natin! Bagong simula! 🧹"
        elif clean.lower() == "/stats":
            h = convo.get("history", [])
            user_msgs = sum(1 for m in h if m.get("role") == "user")
            bot_msgs = sum(1 for m in h if m.get("role") == "assistant")
            reply = f"📊 Stats natin {sender_name}\nIkaw: {user_msgs} msgs\nAko: {bot_msgs} msgs\nTotal: {len(h)} messages"
        else:
            # Forward to TeleClaw bot (non-blocking, fire and forget)
            logging.info(f"Forwarding message to TeleClaw: {clean}")
            send_message_to_teleclaw(clean, sender_name)
            reply = f"Sending your question to TeleClaw, {sender_name}! 🚀 Wait for the response in the group..."

        # Prevent exact echo: if reply equals the input, use fallback
        try:
            if reply and clean and reply.strip().lower() == clean.strip().lower():
                logging.info(f"Detected exact-echo for task {task_id}: original='{clean}' reply='{reply}' — applying fallback")
                reply = f"Hmm, narinig kita — parang ikaw ngayon? 😅"

            logging.info(f"Task {task_id} internal reply prepared: original='{clean}' reply='{reply}'")

            # Save reply to conversation and clean up task
            state = load_state()
            convo = state["conversations"].get(str(chat_id), {"history": []})
            convo["history"].append({"role": "assistant", "text": reply, "ts": int(time.time())})
            state["conversations"][str(chat_id)] = convo
            state["tasks"].pop(task_id, None)
            save_state(state)
        except Exception:
            logging.exception("Failed to save conversation after agent reply")

        # send reply
        logging.info(f"Sending reply for task {task_id} to chat {chat_id}")
        send_message(chat_id, reply, reply_to=message_id)

    # schedule worker thread
    threading.Thread(target=task_worker, daemon=True).start()


def deliver_agent_reply(task_id, reply_text):
    # Called by external agent callback or internal worker to deliver reply
    state = load_state()
    task = state.get("tasks", {}).get(task_id)
    if not task:
        logging.warning(f"deliver_agent_reply: unknown task {task_id}")
        return False
    chat_id = task.get("chat_id")
    message_id = task.get("message_id")
    original_text = task.get("text", "")

    try:
        # Prevent exact echo from external agent
        if reply_text and original_text and reply_text.strip().lower() == original_text.strip().lower():
            logging.info(f"deliver_agent_reply: detected exact-echo for task {task_id}; applying fallback")
            reply_text = f"Hmm, narinig kita — parang ikaw ngayon? 😅"

        logging.info(f"deliver_agent_reply: task={task_id} original='{original_text}' reply='{reply_text}'")

        # append to conversation
        convo = state["conversations"].get(str(chat_id), {"history": []})
        convo["history"].append({"role": "assistant", "text": reply_text, "ts": int(time.time())})
        state["conversations"][str(chat_id)] = convo
        # remove task
        state["tasks"].pop(task_id, None)
        save_state(state)
    except Exception:
        logging.exception("Failed to persist agent reply")

    logging.info(f"Sending agent reply for task {task_id} to chat {chat_id}")
    send_message(chat_id, reply_text, reply_to=message_id)
    return True


def internal_agent_reply(clean, sender_name, convo):
    # Very simple pattern / template based logic for a free internal agent
    # If recent user message asks question words, try to answer
    q_words = ("ano", "sino", "bakit", "paano", "kailan", "sino", "saan")
    low = clean.lower()
    if any(low.startswith(w + " ") or low == w for w in q_words):
        return f"Good question, {sender_name}! Hindi ako sigurado pero baka ... (free agent reply) 😅"

    # Echo with persona
    choices = [
        f"{sender_name}, interesting yan! Pero ano sa tingin mo? 🤔",
        f"Ah, {sender_name}, ang ganda ng tanong mo — nakakaintriga! 😏",
        f"Ooh, usapan na yan! Para sakin, {sender_name}, baka kasi...",
    ]
    return random.choice(choices)


@app.route("/agent_callback/<secret>", methods=["POST"])
def agent_callback(secret):
    # validate secret and Authorization header
    auth = request.headers.get("Authorization", "")
    if secret != (os.environ.get("AGENT_CALLBACK_SECRET") or AGENT_SECRET):
        logging.warning("agent_callback: invalid path secret")
        return jsonify({"ok": False}), 403
    if AGENT_SECRET and auth != f"Bearer {AGENT_SECRET}":
        logging.warning("agent_callback: invalid auth header")
        return jsonify({"ok": False}), 403

    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"ok": False}), 400
    task_id = data.get("task_id")
    reply = data.get("reply")
    if not task_id or reply is None:
        return jsonify({"ok": False}), 400

    ok = deliver_agent_reply(task_id, reply)
    return jsonify({"ok": ok})


@app.route("/", methods=["GET"])
def index():
    state = load_state()
    return jsonify({
        "status": "running",
        "bot": "Kuya-B-Bot",
        "integration": "teleclaw-bot",
        "time": datetime.now(timezone.utc).isoformat(),
        "tasks_pending": len(state.get("tasks", {})),
    })


@app.route("/health", methods=["GET"])
def health():
    state = load_state()
    return jsonify({
        "status": "ok",
        "tasks_pending": len(state.get("tasks", {})),
        "conversations": len(state.get("conversations", {})),
        "teleclaw_pending": len(state.get("teleclaw_pending", {})),
    })


@app.route(f"/webhook/{WEBHOOK_SECRET}", methods=["POST"])
def webhook():
    update = request.get_json(force=True, silent=True)
    if not update:
        return jsonify({"ok": False}), 400

    message = update.get("message")
    if not message:
        return jsonify({"ok": True})

    # basic check if we should handle
    try:
        if message_is_from_bot(message) and not is_from_teleclaw_bot(message):
            return jsonify({"ok": True})
        if not (message.get("text") or message.get("caption")):
            return jsonify({"ok": True})
        
        chat_id = message.get("chat", {}).get("id")
        
        # Handle replies from TeleClaw bot
        if is_from_teleclaw_bot(message) and chat_id == TELECLAW_BOT_CHAT_ID:
            logging.info("Received message from TeleClaw bot")
            reply_to = message.get("reply_to_message")
            if reply_to:
                original_msg_id = str(reply_to.get("message_id"))
                reply_text = message.get("text") or message.get("caption") or ""
                
                # Check if this is a reply to a message we sent
                state = load_state()
                pending = state.get("teleclaw_pending", {}).get(original_msg_id)
                
                if pending:
                    original_user = pending.get("original_user", "Unknown")
                    # Format the response to post to group
                    formatted_reply = f"<b>TeleClaw's reply to {original_user}:</b>\n{reply_text}"
                    
                    # Post to group chat
                    send_message(GROUP_CHAT_ID, formatted_reply)
                    
                    # Clean up pending request
                    state["teleclaw_pending"].pop(original_msg_id, None)
                    save_state(state)
                    
                    logging.info(f"Posted TeleClaw reply to group chat")
            return jsonify({"ok": True})
        
        # Handle regular messages with keyword
        if keyword_mentioned(message):
            # process asynchronously
            threading.Thread(target=process_message, args=(message,), daemon=True).start()
    except Exception:
        logging.exception("Error in webhook processing")

    return jsonify({"ok": True})


def initialize_and_run():
    # ensure state file and lock are initialized
    _ = load_state()
    # try to set webhook automatically if RENDER_EXTERNAL_URL is provided
    set_webhook_if_requested()


if __name__ == "__main__":
    initialize_and_run()
    port = int(os.environ.get("PORT", 10000))
    # run with Flask for local; in production use gunicorn (Dockerfile)
    app.run(host="0.0.0.0", port=port)
