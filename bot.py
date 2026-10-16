import os
import sys
import json
import base64
import logging
import asyncio
import traceback
from contextlib import asynccontextmanager
import httpx
import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, HTMLResponse, RedirectResponse
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Load the modular API route registry.
get_all_routes = None
try:
    from webapp.core.routes import get_all_routes
except ImportError as e:
    logger.warning(f"Could not import webapp.core.routes: {e}")

BOT_TOKEN = os.environ.get("BOT_TOKEN")
ADMIN_CHAT_ID = os.environ.get("ADMIN_CHAT_ID", "7698531657")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "Fredmno/Kuya-B-Bot")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")
RENDER_API_KEY = os.environ.get("RENDER_API_KEY")
RENDER_SERVICE_ID = os.environ.get("RENDER_SERVICE_ID", "srv-d8vn7n6rnols73dtbf00")
PORT = int(os.environ.get("PORT", "10000"))
WEBHOOK_URL = os.environ.get("RENDER_EXTERNAL_URL") or os.environ.get("WEBHOOK_URL")

def get_clean_repo():
    repo = GITHUB_REPO or ""
    if "github.com/" in repo:
        repo = repo.split("github.com/")[-1].replace(".git", "").strip("/")
    return repo.strip()

# --- Render Deployment Polling ---
async def poll_render_deploy(status_msg, commit_sha: str, rel_path: str, commit_msg: str):
    if not (RENDER_API_KEY and RENDER_SERVICE_ID):
        await status_msg.edit_text(
            f"🚀 *Commit Pushed to GitHub!*\n\n"
            f"📄 *File:* `{rel_path}`\n"
            f"💬 *Message:* {commit_msg}\n"
            f"🔗 *Commit SHA:* `{commit_sha}`\n\n"
            "ℹ️ _Render credentials not set; automatic build running._",
            parse_mode="Markdown"
        )
        return

    render_headers = {
        "Authorization": f"Bearer {RENDER_API_KEY}",
        "Accept": "application/json"
    }
    url = f"https://api.render.com/v1/services/{RENDER_SERVICE_ID}/deploys?limit=5"

    for _ in range(25):
        await asyncio.sleep(12)
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(url, headers=render_headers, timeout=10.0)
                if r.status_code == 200:
                    deploys = r.json()
                    for item in deploys:
                        deploy_obj = item.get("deploy", {})
                        c_id = deploy_obj.get("commit", {}).get("id", "")
                        if c_id.startswith(commit_sha) or commit_sha.startswith(c_id[:7]):
                            status = deploy_obj.get("status", "").lower()
                            if status == "live":
                                await status_msg.edit_text(
                                    f"✅ *Render Deployment Live!*\n\n"
                                    f"📄 *File:* `{rel_path}`\n"
                                    f"💬 *Message:* {commit_msg}\n"
                                    f"🔗 *Commit SHA:* `{commit_sha}`\n\n"
                                    "🟢 Status: *Success (Live)*",
                                    parse_mode="Markdown"
                                )
                                return
                            elif status in ("build_failed", "update_failed", "canceled"):
                                await status_msg.edit_text(
                                    f"❌ *Render Deployment Failed*\n\n"
                                    f"📄 *File:* `{rel_path}`\n"
                                    f"🔗 *Commit SHA:* `{commit_sha}`\n\n"
                                    "⚠️ Status: *{status.replace('_', ' ').title()}*",
                                    parse_mode="Markdown"
                                )
                                return
        except Exception as e:
            logger.warning(f"Error polling Render API: {e}")

# --- JSON Committer Handler ---
async def admin_json_committer_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return

    user_id = str(update.effective_user.id)
    if user_id != str(ADMIN_CHAT_ID):
        return

    raw_text = update.message.text.strip()
    if raw_text.startswith("```"):
        lines = raw_text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        raw_text = "\n".join(lines).strip()

    if not (raw_text.startswith("{") and raw_text.endswith("}")):
        return

    try:
        data = json.loads(raw_text)
    except Exception:
        return

    if data.get("action") != "commit_file" and not ("path" in data and "content" in data):
        return

    rel_path = (data.get("path") or data.get("file_path") or "").strip().lstrip("/")
    commit_msg = (data.get("message") or data.get("commit_message") or f"Update {rel_path}").strip()
    content_str = data.get("content", "")

    if not rel_path:
        await update.message.reply_text("❌ Error: Missing `path` in JSON payload.", parse_mode="Markdown")
        return

    if not GITHUB_TOKEN:
        await update.message.reply_text("❌ Error: `GITHUB_TOKEN` is not configured.", parse_mode="Markdown")
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
            sha = None
            get_res = await client.get(f"{api_url}?ref={branch}", headers=headers, timeout=12.0)
            if get_res.status_code == 200:
                sha = get_res.json().get("sha")

            encoded_content = base64.b64encode(content_str.encode("utf-8")).decode("utf-8")
            payload = {
                "message": commit_msg,
                "content": encoded_content,
                "branch": branch
            }
            if sha:
                payload["sha"] = sha

            put_res = await client.put(api_url, json=payload, headers=headers, timeout=20.0)
            if put_res.status_code in (200, 201):
                res_data = put_res.json()
                commit_sha = res_data.get("commit", {}).get("sha", "")[:7]
                await status_msg.edit_text(
                    f"🚀 *Commit Pushed Successfully!*\n\n"
                    f"📄 *File:* `{rel_path}`\n"
                    f"💬 *Message:* {commit_msg}\n"
                    f"🔗 *Commit SHA:* `{commit_sha}`\n\n"
                    "⏳ *Render deployment in progress...*",
                    parse_mode="Markdown"
                )
                asyncio.create_task(poll_render_deploy(status_msg, commit_sha, rel_path, commit_msg))
            else:
                err_msg = put_res.json().get("message", put_res.text) if put_res.headers.get("content-type", "").startswith("application/json") else put_res.text[:150]
                await status_msg.edit_text(f"❌ *GitHub API Error (HTTP {put_res.status_code}):*\n`{err_msg}`", parse_mode="Markdown")
    except Exception as e:
        logger.error(f"Error during commit: {e}")
        await status_msg.edit_text(f"❌ *Commit Failed:* `{str(e)}`", parse_mode="Markdown")

# Optional modular fallback if bot_handlers exists
try:
    from bot_handlers.json_committer import handle_json_commit_message
    active_committer_handler = handle_json_commit_message
except ImportError:
    active_committer_handler = admin_json_committer_handler

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    await update.message.reply_text(
        f"Kumusta {user.first_name}! Ako si Kuya B. 🤖\n\n"
        "• Send your commit JSON payload here to push updates to GitHub.\n"
        "• Or use `/push_drive <drive_link> <repo_path>` to commit directly from Google Drive!"
    )

tg_app = None

async def health_handler(request: Request):
    return JSONResponse({"status": "healthy", "bot": "online", "app": "Kuya B"})

async def telegram_webhook_handler(request: Request):
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

async def fallback_redirect(request: Request):
    return RedirectResponse(url="/app/")

async def fallback_index(request: Request):
    webapp_index = os.path.join(BASE_DIR, "webapp", "index.html")
    if os.path.isfile(webapp_index):
        with open(webapp_index, "r", encoding="utf-8") as f:
            return HTMLResponse(f.read())
    return HTMLResponse("<h2>Kuya B Hub is loading... Please refresh.</h2>")

@asynccontextmanager
async def lifespan(app: Starlette):
    global tg_app
    if BOT_TOKEN:
        try:
            logger.info("Initializing Telegram Bot Application...")
            tg_app = Application.builder().token(BOT_TOKEN).build()
            await tg_app.initialize()

            tg_app.add_handler(CommandHandler("start", start_command))
            tg_app.add_handler(
                MessageHandler(filters.TEXT & ~filters.COMMAND, active_committer_handler),
                group=0
            )

            # Register modular push_drive command handler
            try:
                from webapp.features.push_drive import get_command_handler
                tg_app.add_handler(get_command_handler())
                logger.info("Registered /push_drive command handler.")
            except Exception as e:
                logger.warning(f"push_drive feature not loaded: {e}")

            await tg_app.start()

            if WEBHOOK_URL:
                clean_url = WEBHOOK_URL.rstrip("/")
                webhook_endpoint = f"{clean_url}/webhook"
                logger.info(f"Setting webhook to {webhook_endpoint}")
                try:
                    await tg_app.bot.set_webhook(url=webhook_endpoint)
                except Exception as e:
                    logger.warning(f"Failed to set webhook: {e}")
            else:
                logger.info("No WEBHOOK_URL specified; webhook not registered.")
        except Exception as e:
            logger.error(f"Failed to initialize Telegram Bot: {e}")
            logger.error(traceback.format_exc())
    else:
        logger.error("BOT_TOKEN is missing!")

    yield

    if tg_app:
        logger.info("Shutting down Telegram Bot...")
        try:
            await tg_app.stop()
            await tg_app.shutdown()
        except Exception as e:
            logger.warning(f"Error shutting down Telegram app: {e}")

def create_application() -> Starlette:
    routes = [
        Route("/", endpoint=fallback_redirect, methods=["GET"]),
        Route("/app", endpoint=fallback_redirect, methods=["GET"]),
        Route("/app/", endpoint=fallback_index, methods=["GET"]),
        Route("/health", endpoint=health_handler, methods=["GET"]),
        Route("/webhook", endpoint=telegram_webhook_handler, methods=["POST"]),
    ]

    if get_all_routes:
        try:
            routes.extend(get_all_routes())
        except Exception as e:
            logger.error(f"Failed calling get_all_routes: {e}")
            logger.error(traceback.format_exc())

    # Keep the static app mount after API routes so /app/api/* endpoints win.
    webapp_dir = os.path.join(BASE_DIR, "webapp")
    if os.path.isdir(webapp_dir):
        routes.append(Mount("/app", app=StaticFiles(directory=webapp_dir, html=True), name="static_app"))

    return Starlette(routes=routes, lifespan=lifespan)

app = create_application()

if __name__ == "__main__":
    logger.info(f"Starting Kuya B server on port {PORT}...")
    config = uvicorn.Config(
        app=app,
        host="0.0.0.0",
        port=PORT,
        log_level="info",
        access_log=True,
    )
    server = uvicorn.Server(config)
    try:
        asyncio.run(server.serve())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Server stopped.")
    except Exception as e:
        logger.error(f"Server crashed: {e}")
        traceback.print_exc()
