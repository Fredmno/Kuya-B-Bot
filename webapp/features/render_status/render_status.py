import os
import httpx
from starlette.requests import Request
from starlette.responses import JSONResponse

BOT_TOKEN = os.environ.get("BOT_TOKEN")
ADMIN_CHAT_ID = "7698531657"

async def send_tg_message(text: str):
    """Sends Telegram status alerts directly to your chat."""
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

async def github_webhook_handler(request: Request):
    """Handles GitHub push event webhooks."""
    try:
        data = await request.json()
    except Exception:
        data = {}

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

async def render_webhook_handler(request: Request):
    """Handles Render deploy event webhooks."""
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
            "• *Service:* Kuya-B-Bot-1"
        )
        await send_tg_message(msg)

    return JSONResponse({"status": "received"})
