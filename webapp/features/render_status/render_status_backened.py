import os
import httpx
from datetime import datetime
from starlette.requests import Request
from starlette.responses import JSONResponse

BOT_TOKEN = os.environ.get("BOT_TOKEN")
ADMIN_CHAT_ID = "7698531657"

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "alfredodimaano/Kuya-B-Bot-1")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")

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
    """Fetches real commits and deployment history using GITHUB_TOKEN."""
    token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPO", "alfredodimaano/Kuya-B-Bot-1")
    branch = os.environ.get("GITHUB_BRANCH", "main")

    if "github.com/" in repo:
        repo = repo.split("github.com/")[-1].replace(".git", "").strip("/")

    if token:
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json"
        }
        url = f"https://api.github.com/repos/{repo}/commits?sha={branch}&per_page=15"
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, headers=headers, timeout=10.0)
                if res.status_code == 200:
                    raw_commits = res.json()
                    formatted = []
                    for idx, item in enumerate(raw_commits):
                        commit_info = item.get("commit", {})
                        author_info = commit_info.get("author", {})
                        sha = item.get("sha", "")[:7]
                        raw_msg = commit_info.get("message", "No commit message")
                        first_line = raw_msg.splitlines()[0] if raw_msg else "Update"

                        raw_date = author_info.get("date", "")
                        date_str = raw_date[:16].replace("T", " ") if raw_date else "Recent"

                        # Mark most recent commit as Live, rest as Success
                        status_label = "Live" if idx == 0 else "Success"

                        formatted.append({
                            "id": f"commit-{sha}",
                            "name": f"Deploy #{len(raw_commits) - idx} — {first_line[:40]}",
                            "date": date_str,
                            "status": status_label,
                            "commit": sha,
                            "author": author_info.get("name", "GitHub"),
                            "message": raw_msg
                        })
                    return JSONResponse({"deployments": formatted})
        except Exception as e:
            print(f"Error fetching commits from GitHub: {e}")

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
