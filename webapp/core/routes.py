import os
import httpx
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from starlette.requests import Request
from starlette.responses import JSONResponse

try:
    from webapp.core.index_consolidator import serve_index
except ImportError:
    from index_consolidator import serve_index

WEBAPP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CORE_DIR = os.path.join(WEBAPP_DIR, "core")

BOT_TOKEN = os.environ.get("BOT_TOKEN")
ADMIN_CHAT_ID = "7698531657"

async def send_tg_message(text: str):
    """Sends Telegram notifications directly to you."""
    if not BOT_TOKEN:
        return
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": ADMIN_CHAT_ID,
        "text": text,
        "parse_mode": "Markdown"
    }
    try:
        async with httpx.AsyncClient() as client:
            await client.post(url, json=payload, timeout=10.0)
    except Exception as e:
        print(f"Error sending TG notification: {e}")

async def github_webhook_endpoint(request: Request):
    """Triggered on ANY git push to GitHub (regardless of source/tool)."""
    try:
        data = await request.json()
    except Exception:
        data = {}

    # Extract git commit info
    commits = data.get("commits", [])
    pusher = data.get("pusher", {}).get("name", "Unknown")
    ref = data.get("ref", "")
    branch = ref.split("/")[-1] if "/" in ref else ref

    if commits:
        latest = commits[-1]
        commit_id = latest.get("id", "")[:7]
        commit_msg = latest.get("message", "No commit message").strip()
        files_modified = len(latest.get("modified", [])) + len(latest.get("added", [])) + len(latest.get("removed", []))

        msg = (
            "📦 *New Commit Pushed*\n\n"
            f"• *Branch:* `{branch}`\n"
            f"• *Author:* {pusher}\n"
            f"• *Commit:* `{commit_id}`\n"
            f"• *Message:* {commit_msg}\n"
            f"• *Files Changed:* {files_modified}\n\n"
            "⏳ _Render deployment should trigger shortly..._"
        )
        await send_tg_message(msg)

    return JSONResponse({"status": "received"})

async def render_webhook_endpoint(request: Request):
    """Triggered automatically by Render whenever a deploy starts or finishes."""
    try:
        data = await request.json()
    except Exception:
        data = {}

    event = data.get("event")  # deploy_started, deploy_ended
    deploy = data.get("deploy", {})
    status = deploy.get("status", "unknown").lower()
    commit_info = deploy.get("commit", {})
    commit_msg = commit_info.get("message", "N/A").strip()
    commit_id = commit_info.get("id", "")[:7]

    if event == "deploy_started":
        msg = (
            "🔨 *Render Build Started*\n\n"
            f"• *Commit:* `{commit_id}`\n"
            f"• *Message:* {commit_msg}\n"
            "• *Status:* Building & deploying..."
        )
        await send_tg_message(msg)

    elif event == "deploy_ended":
        if status in ["live", "succeeded"]:
            emoji = "✅"
            status_text = "DEPLOY LIVE (Success)"
        else:
            emoji = "❌"
            status_text = f"DEPLOY FAILED ({status.upper()})"

        msg = (
            f"{emoji} *Render Deployment Finished*\n\n"
            f"• *Status:* *{status_text}*\n"
            f"• *Commit:* `{commit_id}`\n"
            f"• *Message:* {commit_msg}\n"
            "• *Service:* Kuya B Hub"
        )
        await send_tg_message(msg)

    return JSONResponse({"status": "received"})

def get_all_routes(health_check_handler=None, telegram_webhook_handler=None, webhook_path="/webhook"):
    routes = [
        Route("/app", endpoint=serve_index, methods=["GET"]),
        Mount("/app/core", StaticFiles(directory=CORE_DIR), name="core"),
        
        # Automatic Webhook Handlers
        Route("/api/github-webhook", endpoint=github_webhook_endpoint, methods=["POST"]),
        Route("/api/render-webhook", endpoint=render_webhook_endpoint, methods=["POST"]),
    ]

    features_dir = os.path.join(WEBAPP_DIR, "features")
    modules_dir = os.path.join(WEBAPP_DIR, "modules")
    root_dashboard_dir = os.path.join(WEBAPP_DIR, "dashboard")

    if os.path.exists(features_dir):
        routes.append(Mount("/app/features", StaticFiles(directory=features_dir), name="features"))
    if os.path.exists(modules_dir):
        routes.append(Mount("/app/modules", StaticFiles(directory=modules_dir), name="modules"))
    if os.path.exists(root_dashboard_dir):
        routes.append(Mount("/app/dashboard", StaticFiles(directory=root_dashboard_dir), name="root_dashboard"))

    if health_check_handler:
        routes.append(Route("/health", endpoint=health_check_handler, methods=["GET"]))

    if telegram_webhook_handler:
        routes.append(Route(webhook_path, endpoint=telegram_webhook_handler, methods=["POST"]))

    return routes
