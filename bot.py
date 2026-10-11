import os
import sys
import json
import base64
import logging
import asyncio
from contextlib import asynccontextmanager
import httpx
import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

# Set up logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Ensure project directories are in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Import WebApp routes
try:
    from webapp.core.routes import get_all_routes
except ImportError:
    try:
        from core.routes import get_all_routes
    except ImportError:
        get_all_routes = None

# Environment configuration
BOT_TOKEN = os.environ.get("BOT_TOKEN")
ADMIN_CHAT_ID = os.environ.get("ADMIN_CHAT_ID", "7698531657")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "Fredmno/Kuya-B-Bot")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")
PORT = int(os.environ.get("PORT", "10000"))
WEBHOOK_URL = os.environ.get("RENDER_EXTERNAL_URL") or os.environ.get("WEBHOOK_URL")

def get_clean_repo():
    repo = GITHUB_REPO
    if "github.com/" in repo:
        repo = repo.split("github.com/")[-1].replace(".git", "").strip("/")
    return repo.strip()

# --- Telegram Bot Handlers ---

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles the /start command."""
    user = update.effective_user
    await update.message.reply_text(
        f"Kumusta {user.first_name}! Ako si Kuya B. 🤖\n\n"
        "Ready to assist with management, tasks, and system updates."
    )

async def admin_json_committer_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Listens for JSON commit payloads sent by the admin in Telegram chat,
    pushes changes directly to GitHub via REST API, and triggers Render deployment.
    """
    if not update.message or not update.message.text:
        return

    # Restrict to Admin
    user_id = str(update.effective_user.id)
    if user_id != str(ADMIN_CHAT_ID):
        return

    raw_text = update.message.text.strip()

    # Strip code block wrapping (e.g. ```json ... ```)
    if raw_text.startswith("```"):
        lines = raw_text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        raw_text = "\n".join(lines).strip()

    # Detect if text is a JSON payload
    if not (raw_text.startswith("{") and raw_text.endswith("}")):
        return

    try:
        data = json.loads(raw_text)
    except Exception:
        return  # Regular chat message; ignore

    # Verify commit action payload
    if data.get("action") != "commit_file" and not ("path" in data and "content" in data):
        return

    rel_path = (data.get("path") or data.get("file_path") or "").strip().lstrip("/")
    commit_msg = (data.get("message") or data.get("commit_message") or f"Update {rel_path}").strip()
    content_str = data.get("content", "")

    if not rel_path:
        await update.message.reply_text("❌ Error: Missing `path` in JSON payload.", parse_mode="Markdown")
        return

    if not GITHUB_TOKEN:
        await update.message.reply_text("❌ Error: `GITHUB_TOKEN` environment variable is not configured.", parse_mode="Markdown")
        return

    repo = get_clean_repo()
    branch = GITHUB_BRANCH
    status_msg = await update.message.reply_text(f"⏳ Committing `{rel_path}` to GitHub...", parse_mode="Markdown")

    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "KuyaB-Bot-App"
    }
    api_url = f"[https://api.github.com/repos/](https://api.github.com/repos/){repo}/contents/{rel_path}"

    try:
        async with httpx.AsyncClient() as client:
            # 1. Check if the file exists to grab its current SHA
            sha = None
            get_res = await client.get(f"{api_url}?ref={branch}", headers=headers, timeout=12.0)
            if get_res.status_code == 200:
                sha = get_res.json().get("sha")

            # 2. Encode file content into base64
            encoded_content = base64.b64encode(content_str.encode("utf-8")).decode("utf-8")
            payload = {
                "message": commit_msg,
                "content": encoded_content,
                "branch": branch
            }
            if sha:
                payload["sha"] = sha

            # 3. Commit file via PUT request
            put_res = await client.put(api_url, json=payload, headers=headers, timeout=20.0)

            if put_res.status_code in (200, 201):
                res_data = put_res.json()
                commit_sha = res_data.get("commit", {}).get("sha", "")[:7]
                await status_msg.edit_text(
                    f"🚀 *Commit Pushed Successfully!*\n\n"
                    f"📄 *File:* `{rel_path}`\n"
                    f"💬 *Message:* {commit_msg}\n"
                    f"🔗 *Commit SHA:* `{commit_sha}`\n\n"
                    f"Render deployment automatically triggered.",
                    parse_mode="Markdown"
                )
            else:
                err_msg = put_res.json().get("message", put_res.text) if put_res.headers.get("content-type", "").startswith("application/json") else put_res.text[:150]
                await status_msg.edit_text(
                    f"❌ *GitHub API Error (HTTP {put_res.status_code}):*\n`{err_msg}`",
                    parse_mode="Markdown"
                )
    except Exception as e:
        logger.error(f"Error during commit: {e}")
        await status_msg.edit_text(f"❌ *Commit Failed:* `{str(e)}`", parse_mode="Markdown")

# --- App Initialization & Server Routing ---

tg_app = None

async def health_handler(request: Request):
    """Health check endpoint for Render."""
    return JSONResponse({"status": "healthy", "bot": "online", "app": "Kuya B"})

async def telegram_webhook_handler(request: Request):
    """Receives webhook updates from Telegram."""
    if tg_app is None:
        return JSONResponse({"error": "Bot not initialized"}, status_code=500)
    try:
        data = await request.json()
        update = Update.de_json(data, tg_app.bot)
        await tg_app.process_update(update)
        return JSONResponse({"ok": True})
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        return JSONResponse({"error": str(e)}, status_code=400)

@asynccontextmanager
async def lifespan(app: Starlette):
    """Handles startup and shutdown lifecycles using modern async context manager."""
    global tg_app
    if BOT_TOKEN:
        logger.info("Initializing Telegram Bot Application...")
        tg_app = Application.builder().token(BOT_TOKEN).build()
        await tg_app.initialize()

        # Register Bot Handlers
        tg_app.add_handler(CommandHandler("start", start_command))
        tg_app.add_handler(
            MessageHandler(filters.TEXT & ~filters.COMMAND, admin_json_committer_handler),
            group=0
        )

        await tg_app.start()

        # Set Webhook if URL is configured
        if WEBHOOK_URL:
            clean_url = WEBHOOK_URL.rstrip("/")
            webhook_endpoint = f"{clean_url}/webhook"
            logger.info(f"Setting webhook to {webhook_endpoint}")
            await tg_app.bot.set_webhook(url=webhook_endpoint)
        else:
            logger.warning("RENDER_EXTERNAL_URL / WEBHOOK_URL not set. Running in webhook-ready mode.")
    else:
        logger.error("BOT_TOKEN is missing!")

    yield

    if tg_app:
        logger.info("Shutting down Telegram Bot...")
        await tg_app.stop()
        await tg_app.shutdown()

def create_application() -> Starlette:
    """Builds and returns the Starlette application."""
    if get_all_routes:
        routes = get_all_routes(
            health_check_handler=health_handler,
            telegram_webhook_handler=telegram_webhook_handler,
            webhook_path="/webhook"
        )
    else:
        from starlette.routing import Route
        routes = [
            Route("/health", endpoint=health_handler, methods=["GET"]),
            Route("/webhook", endpoint=telegram_webhook_handler, methods=["POST"]),
        ]

    return Starlette(routes=routes, lifespan=lifespan)

app = create_application()

if __name__ == "__main__":
    logger.info(f"Starting Kuya B server on port {PORT}...")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
