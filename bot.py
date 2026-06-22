from flask import Flask, request, jsonify
import os
import re
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

WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET") or BOT_TOKEN
AGENT_URL = os.environ.get("AGENT_URL")
AGENT_SECRET = os.environ.get("AGENT_SECRET") or WEBHOOK_SECRET
RENDER_EXTERNAL_URL = os.environ.get("RENDER_EXTERNAL_URL")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")

# Behaviour configuration
KEYWORD_PATTERN = re.compile(r"\bkuya[-_ ]?b\b", flags=re.IGNORECASE)
COOLDOWN_SECONDS = int(os.environ.get("COOLDOWN_SECONDS", "5"))
TASK_TTL_SECONDS = int(os.environ.get("TASK_TTL_SECONDS", "1200"))  # 20 minutes default

INTERACTIVE_REPLIES = {
    "kamusta": [
        "Mas lalong gumaganda/gwapo pag nakikita ko chat mo 😏",
        "Okay naman, mas okay siguro kung magkape tayo ☕",
        "Bakit? Miss mo na ba ko? 😌💕"
    ],
    "miss": [
        "Miss din kita, lalo na pag tahimik ka jan 🥺",
        "Sabi ko na eh, alam kong may nag-iisip sakin 😏",
        "Totoo ba? Sige patunayan mo, chat ka palagi ha? 💖"
    ],
    "love": [
        "Hala siya, nahulog na ba? 😳💕",
        "Love na love? Chz! Pero pag nagpatuloy to baka nga 🫣",
        "Grabe ka naman, napapangiti mo ko eh 😊💓"
    ],
    "good morning": [
        "Good morning din, sikat ng araw ko ☀️💖",
        "Gising agad para ma-chat ka? Worth it naman 😏",
        "Morning! Pangga-good morning mo ba ko araw-araw? 🥹"
    ],
    "good night": [
        "Goodnight! Pangarapin mo naman ako ha? 😴💭",
        "Matutulog na pero naka-ngiti kasi nakausap kita 😊🌙",
        "Goodnight, ingatan mo yung puso mo... akin yan eh 😌💕"
    ],
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

        if "tasks" not in state:
            state["tasks"] = {}
        if "conversations" not in state:
            state["conversations"] = {}
        if "last_flirty" not in state:
            state["last_flirty"] = ""

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
        r = requests.post(url, json=payload, timeout=15)
        if r.status_code == 429:
            try:
                data = r.json()
                retry_after = int(data.get("parameters", {}).get("retry_after") or data.get("retry_after") or 1)
            except Exception:
                retry_after = 1
            logging.warning(f"Rate limited by Telegram, sleeping {retry_after + 1}s then retrying")
            time.sleep(retry_after + 1)
            r = requests.post(url, json=payload, timeout=15)

        if not r.ok:
            logging.warning(f"Telegram sendMessage failed ({r.status_code}): {r.text}")
            return None
        return r.json().get("result")
    except Exception:
        logging.exception("Failed to send message")
        return None


def ask_gemini(prompt: str, sender_name: str = "User") -> str:
    if not GEMINI_API_KEY:
        logging.warning("GEMINI_API_KEY is not set")
        return "Sorry, Gemini API key is not configured."

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"

    system_prompt = f"""
You are Kuya B.

You are friendly, helpful, conversational, and a little playful.
You answer clearly and naturally.
You can help with technology, productivity, work questions, and daily life questions.
Keep answers concise but useful unless the user asks for more detail.
When appropriate, sound like a warm Filipino kuya.

The user's name is: {sender_name}
"""

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"{system_prompt}\n\nUser question: {prompt}"
                    }
                ]
            }
        ]
    }

    try:
        r = requests.post(url, json=payload, timeout=30)

        if not r.ok:
            logging.warning(f"Gemini API failed ({r.status_code}): {r.text}")
            return "Sorry, Gemini is unavailable right now."

        data = r.json()

        candidates = data.get("candidates", [])
        if not candidates:
            logging.warning(f"Gemini returned no candidates: {data}")
            return "Sorry, Gemini did not return an answer."

        parts = candidates[0].get("content", {}).get("parts", [])
        if not parts:
            logging.warning(f"Gemini returned empty parts: {data}")
            return "Sorry, Gemini returned an empty response."

        answer = "".join(part.get("text", "") for part in parts).strip()
        if not answer:
            return "Sorry, Gemini returned an empty response."

        return answer

    except Exception:
        logging.exception("Gemini request failed")
        return "Sorry, something went wrong while talking to Gemini."


def handle_message_text(text: str):
    text_lower = (text or "").lower()
    for keyword, replies in INTERACTIVE_REPLIES.items():
        if keyword in text_lower:
            return random.choice(replies)
    return None


def message_is_from_bot(msg):
    return msg.get("from", {}).get("is_bot", False)


def keyword_mentioned(msg):
    text = msg.get("text", "") or ""
    if not text:
        return False

    if KEYWORD_PATTERN.search(text):
        return True

    return False


def set_webhook_if_requested():
    if not RENDER_EXTERNAL_URL:
        logging.info("RENDER_EXTERNAL_URL not set; skipping auto setWebhook")
        return

    webhook_url = RENDER_EXTERNAL_URL.rstrip("/") + f"/webhook/{WEBHOOK_SECRET}"
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/setWebhook",
            data={"url": webhook_url},
            timeout=10
        )
        if r.ok and r.json().get("ok"):
            logging.info(f"Successfully set webhook to {webhook_url}")
        else:
            logging.warning(f"Failed to set webhook: {r.status_code} {r.text}")
    except Exception:
        logging.exception("Exception while setting webhook")


def process_message(message):
    chat = message.get("chat", {})
    chat_id = chat.get("id")
    if chat_id is None:
        return

    message_id = message.get("message_id")
    sender = message.get("from", {})
    sender_name = sender.get("first_name") or sender.get("username") or "User"
    text = message.get("text") or message.get("caption") or ""
    clean = (text or "").strip()

    # load state and save conversation
    state = load_state()
    convo = state["conversations"].get(str(chat_id), {"history": []})
    convo["history"].append({
        "role": "user",
        "text": clean,
        "from": sender_name,
        "ts": int(time.time())
    })
    state["conversations"][str(chat_id)] = convo
    save_state(state)

    # create task
    task_id = str(uuid.uuid4())
    task_meta = {
        "chat_id": chat_id,
        "message_id": message_id,
        "created_at": int(time.time()),
        "text": clean,
    }

    state = load_state()
    state["tasks"][task_id] = task_meta
    save_state(state)
    logging.info(f"Created task {task_id} for chat {chat_id}")

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
                    deliver_agent_reply(tid, reply)
                    return True
        except Exception:
            logging.exception("External agent call failed")
        return False

    def task_worker():
        state = load_state()
        convo = state["conversations"].get(str(chat_id), {"history": []})

        payload = {
            "task_id": task_id,
            "chat_id": chat_id,
            "sender_name": sender_name,
            "conversation": convo,
            "text": clean,
            "callback_url": None,
        }

        if AGENT_URL:
            logging.info(f"Posting task {task_id} to external agent")
            ok = call_external_task(task_id, payload)
            if ok:
                state = load_state()
                state["tasks"].pop(task_id, None)
                save_state(state)
                return
            logging.info("External agent failed or returned no reply; falling back to Gemini")

        send_action(chat_id)
        reply = None

        if clean.lower() == "/start":
            reply = (
                f"Uy {sender_name}! Ako si Kuya B 🤖\n"
                f"Sabihin mo lang 'kuya b' plus your question, sasagot ako agad."
            )

        elif clean.lower() in ("/help", "/commands"):
            reply = (
                "Kuya B Commands\n"
                "• /start — Simula\n"
                "• /help — Tulong\n"
                "• /forget — Kalimutan usapan\n"
                "• /stats — Stats ng convo\n\n"
                "Pwede ka ring magtanong gamit ang 'kuya b ...'"
            )

        elif clean.lower() == "/forget":
            state = load_state()
            state["conversations"][str(chat_id)] = {"history": []}
            save_state(state)
            reply = f"Sige {sender_name}, reset na usapan natin. 🧹"

        elif clean.lower() == "/stats":
            h = convo.get("history", [])
            user_msgs = sum(1 for m in h if m.get("role") == "user")
            bot_msgs = sum(1 for m in h if m.get("role") == "assistant")
            reply = f"📊 Stats natin {sender_name}\nIkaw: {user_msgs} msgs\nAko: {bot_msgs} msgs\nTotal: {len(h)} messages"

        else:
            casual_reply = handle_message_text(clean)
            if casual_reply and KEYWORD_PATTERN.search(clean):
                reply = casual_reply
            else:
                clean_question = KEYWORD_PATTERN.sub("", clean).strip(" ,:-")
                if not clean_question:
                    clean_question = clean

                logging.info(f"Sending question to Gemini: {clean_question}")
                reply = ask_gemini(clean_question, sender_name)

        try:
            if reply and clean and reply.strip().lower() == clean.strip().lower():
                logging.info(f"Detected exact-echo for task {task_id}; applying fallback")
                reply = "Hmm, narinig kita — parang echo lang yun 😅"

            logging.info(f"Task {task_id} internal reply prepared")

            state = load_state()
            convo = state["conversations"].get(str(chat_id), {"history": []})
            convo["history"].append({
                "role": "assistant",
                "text": reply,
                "ts": int(time.time())
            })
            state["conversations"][str(chat_id)] = convo
            state["tasks"].pop(task_id, None)
            save_state(state)
        except Exception:
            logging.exception("Failed to save conversation after Gemini reply")

        logging.info(f"Sending reply for task {task_id} to chat {chat_id}")
        send_message(chat_id, reply, reply_to=message_id)

    threading.Thread(target=task_worker, daemon=True).start()


def deliver_agent_reply(task_id, reply_text):
    state = load_state()
    task = state.get("tasks", {}).get(task_id)
    if not task:
        logging.warning(f"deliver_agent_reply: unknown task {task_id}")
        return False

    chat_id = task.get("chat_id")
    message_id = task.get("message_id")
    original_text = task.get("text", "")

    try:
        if reply_text and original_text and reply_text.strip().lower() == original_text.strip().lower():
            logging.info(f"deliver_agent_reply: detected exact-echo for task {task_id}; applying fallback")
            reply_text = "Hmm, narinig kita — parang echo lang yun 😅"

        logging.info(f"deliver_agent_reply: task={task_id} original='{original_text}' reply='{reply_text}'")

        convo = state["conversations"].get(str(chat_id), {"history": []})
        convo["history"].append({
            "role": "assistant",
            "text": reply_text,
            "ts": int(time.time())
        })
        state["conversations"][str(chat_id)] = convo

        state["tasks"].pop(task_id, None)
        save_state(state)

    except Exception:
        logging.exception("Failed to persist agent reply")

    logging.info(f"Sending agent reply for task {task_id} to chat {chat_id}")
    send_message(chat_id, reply_text, reply_to=message_id)
    return True


@app.route("/agent_callback/<secret>", methods=["POST"])
def agent_callback(secret):
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
        "integration": "gemini",
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
    })


@app.route(f"/webhook/{WEBHOOK_SECRET}", methods=["POST"])
def webhook():
    update = request.get_json(force=True, silent=True)
    if not update:
        return jsonify({"ok": False}), 400

    message = update.get("message")
    if not message:
        return jsonify({"ok": True})

    try:
        if message_is_from_bot(message):
            return jsonify({"ok": True})

        if not (message.get("text") or message.get("caption")):
            return jsonify({"ok": True})

        text = (message.get("text") or "").strip().lower()

        if keyword_mentioned(message) or text in ["/start", "/help", "/commands", "/forget", "/stats"]:
            threading.Thread(target=process_message, args=(message,), daemon=True).start()

    except Exception:
        logging.exception("Error in webhook processing")

    return jsonify({"ok": True})


def initialize_and_run():
    _ = load_state()
    set_webhook_if_requested()


if __name__ == "__main__":
    initialize_and_run()
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
