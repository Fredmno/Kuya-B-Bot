import os
import httpx
from datetime import datetime
from starlette.requests import Request
from starlette.responses import JSONResponse

BOT_TOKEN = os.environ.get("BOT_TOKEN")
ADMIN_CHAT_ID = "7698531657"

RENDER_API_KEY = os.environ.get("RENDER_API_KEY")
RENDER_SERVICE_ID = os.environ.get("RENDER_SERVICE_ID")  # e.g., srv-xxxxxxxxxxxx

# In-memory backup queue
LOCAL_DEPLOYS = []

async def send_tg_message(text: str):
    """Sends Telegram status alerts."""
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

async def get_deployments_endpoint(request: Request):
    """Fetches real deployment history from Render API or local queue."""
    # Method 1: Query Render API directly if configured
    if RENDER_API_KEY and RENDER_SERVICE_ID:
        headers = {
            "Authorization": f"Bearer {RENDER_API_KEY}",
            "Accept": "application/json"
        }
        url = f"https://api.render.com/v1/services/{RENDER_SERVICE_ID}/deploys?limit=15"
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, headers=headers, timeout=10.0)
                if res.status_code == 200:
                    raw_data = res.json()
                    formatted = []
                    for item in raw_data:
                        deploy = item.get("deploy", item)
                        commit = deploy.get("commit", {})
                        status = deploy.get("status", "unknown").capitalize()
                        
                        created_at = deploy.get("createdAt", "")
                        date_str = created_at[:16].replace("T", " ") if created_at else "Just now"

                        formatted.append({
                            "id": deploy.get("id", ""),
                            "name": f"Deploy: {commit.get('message', 'Update')[:40]}",
                            "date": date_str,
                            "status": "Live" if status.lower() == "live" else status,
                            "commit": commit.get("id", "")[:7],
                            "author": "Render API",
                            "message": commit.get("message", "No commit message")
                        })
                    return JSONResponse({"deployments": formatted})
        except Exception as e:
            print(f"Error fetching from Render API: {e}")

    # Method 2: Fallback to local memory queue if Render API credentials are not set
    return JSONResponse({"deployments": LOCAL_DEPLOYS})

async def github_webhook_handler(request: Request):
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
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

        LOCAL_DEPLOYS.insert(0, {
            "id": f"git-{commit_id}",
            "name": f"Push: {commit_msg.splitlines()[0][:45]}",
            "date": now_str,
            "status": "Building",
            "commit": commit_id,
            "author": pusher,
            "message": commit_msg
        })

        msg = (
            "📦 *New Commit Pushed*\n\n"
            f"• *Branch:* `{branch}`\n"
            f"• *Author:* {pusher}\n"
            f"• *Commit:* `{commit_id}`\n"
            f"• *Message:* {commit_msg}\n\n"
            "⏳ _Render deployment should trigger shortly..._"
        )
        await send_tg_message(msg)

    return JSONResponse({"status": "received"})

async def render_webhook_handler(request: Request):
    try:
        data = await request.json()
    except Exception:
        data = {}

    event = data.get("event")
    deploy = data.get("deploy", {})
    status = deploy.get("status", "unknown").lower()
    commit_info = deploy.get("commit", {})
    commit_msg = commit_info.get("message", "N/A").strip()
    commit_id = commit_info.get("id", "")[:7]
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

    status_label = "Live" if status in ["live", "succeeded"] else ("Failed" if status in ["failed", "canceled"] else "Building")

    found = False
    for item in LOCAL_DEPLOYS:
        if item.get("commit") == commit_id:
            item["status"] = status_label
            item["date"] = now_str
            found = True
            break

    if not found:
        LOCAL_DEPLOYS.insert(0, {
            "id": deploy.get("id", f"dep-{commit_id}"),
            "name": f"Render Deploy: {commit_msg.splitlines()[0][:40]}",
            "date": now_str,
            "status": status_label,
            "commit": commit_id,
            "author": "Render Hook",
            "message": commit_msg
        })

    if event == "deploy_started":
        msg = (
            "🔨 *Render Build Started*\n\n"
            f"• *Commit:* `{commit_id}`\n"
            f"• *Message:* {commit_msg}\n"
            "• *Status:* Building & deploying..."
        )
        await send_tg_message(msg)
    elif event == "deploy_ended":
        emoji = "✅" if status_label == "Live" else "❌"
        msg = (
            f"{emoji} *Render Deployment Finished*\n\n"
            f"• *Status:* *{status_label.upper()}*\n"
            f"• *Commit:* `{commit_id}`\n"
            f"• *Message:* {commit_msg}\n"
            "• *Service:* Kuya-B-Bot-1"
        )
        await send_tg_message(msg)

    return JSONResponse({"status": "received"})
