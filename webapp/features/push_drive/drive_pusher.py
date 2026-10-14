import os
import re
import json
import base64
import logging
import asyncio
import httpx
from telegram import Update
from telegram.ext import CommandHandler, ContextTypes

logger = logging.getLogger(__name__)

# --- Environment & Configuration ---
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "Fredmno/Kuya-B-Bot")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")
ADMIN_CHAT_ID = os.environ.get("ADMIN_CHAT_ID", "7698531657")
RENDER_API_KEY = os.environ.get("RENDER_API_KEY")
RENDER_SERVICE_ID = os.environ.get("RENDER_SERVICE_ID", "srv-d8vn7n6rnols73dtbf00")

def get_clean_repo():
    repo = GITHUB_REPO or ""
    if "github.com/" in repo:
        repo = repo.split("github.com/")[-1].replace(".git", "").strip("/")
    return repo.strip()

def extract_drive_file_id(target: str) -> str:
    """Extracts Google Drive file ID from URLs or returns clean string if raw ID."""
    target = target.strip()
    doc_match = re.search(r"/document/d/([a-zA-Z0-9_-]{20,})", target)
    if doc_match:
        return doc_match.group(1)
    file_match = re.search(r"/file/d/([a-zA-Z0-9_-]{20,})", target)
    if file_match:
        return file_match.group(1)
    id_param = re.search(r"[?&]id=([a-zA-Z0-9_-]{20,})", target)
    if id_param:
        return id_param.group(1)
    clean_id = target.split("?")[0].strip("/")
    if re.match(r"^[a-zA-Z0-9_-]{20,}$", clean_id):
        return clean_id
    return ""

async def fetch_drive_file_content(file_id: str) -> str:
    """Downloads file content from Google Drive via direct export / download endpoints."""
    urls = [
        f"https://docs.google.com/document/d/{file_id}/export?format=txt",
        f"https://drive.google.com/uc?export=download&id={file_id}"
    ]
    headers = {"User-Agent": "KuyaB-DrivePusher/1.0"}

    async with httpx.AsyncClient(follow_redirects=True, timeout=20.0) as client:
        for url in urls:
            try:
                res = await client.get(url, headers=headers)
                if res.status_code == 200 and res.text:
                    if "accounts.google.com" in str(res.url) or "Sign in - Google Accounts" in res.text:
                        raise RuntimeError("Drive file is Restricted. In Google Drive, please set sharing to 'Anyone with the link (Viewer)'.")
                    return res.text
            except Exception as e:
                logger.warning(f"Failed fetching {url}: {e}")

    raise RuntimeError(f"Could not retrieve content for file ID '{file_id}'. Ensure file is shared via link.")

async def push_to_github(rel_path: str, content_str: str, commit_msg: str) -> dict:
    """Commits file content to GitHub via GitHub contents REST API."""
    if not GITHUB_TOKEN:
        raise ValueError("`GITHUB_TOKEN` is not configured.")

    repo = get_clean_repo()
    branch = GITHUB_BRANCH
    rel_path = rel_path.strip().lstrip("/")

    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "KuyaB-Bot-App"
    }
    api_url = f"https://api.github.com/repos/{repo}/contents/{rel_path}"

    async with httpx.AsyncClient(timeout=20.0) as client:
        sha = None
        get_res = await client.get(f"{api_url}?ref={branch}", headers=headers)
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

        put_res = await client.put(api_url, json=payload, headers=headers)
        if put_res.status_code in (200, 201):
            res_data = put_res.json()
            commit_sha = res_data.get("commit", {}).get("sha", "")[:7]
            return {"ok": True, "commit_sha": commit_sha, "path": rel_path}
        else:
            err = put_res.json().get("message", put_res.text) if put_res.headers.get("content-type", "").startswith("application/json") else put_res.text[:150]
            raise RuntimeError(f"GitHub API Error (HTTP {put_res.status_code}): {err}")

# Alias to satisfy __init__.py export
push_drive_to_github = push_to_github

async def poll_render_deploy(status_msg, commit_sha: str, rel_path: str, commit_msg: str):
    """Monitors deployment on Render following a commit and pushes live alerts."""
    if not (RENDER_API_KEY and RENDER_SERVICE_ID):
        await asyncio.sleep(60)
        await status_msg.edit_text(
            f"✅ *Commit Pushed & Active!*\n\n"
            f"📄 *File:* `{rel_path}`\n"
            f"💬 *Message:* {commit_msg}\n"
            f"🔗 *Commit SHA:* `{commit_sha}`\n\n"
            "🟢 Status: *Deployment Live*",
            parse_mode="Markdown"
        )
        await status_msg.reply_text(
            f"🔔 *Deployment Live!*\n\n`{rel_path}` is now active in production on Render.",
            parse_mode="Markdown"
        )
        return

    render_headers = {
        "Authorization": f"Bearer {RENDER_API_KEY}",
        "Accept": "application/json"
    }
    url = f"https://api.render.com/v1/services/{RENDER_SERVICE_ID}/deploys?limit=5"

    for _ in range(30):
        await asyncio.sleep(10)
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(url, headers=render_headers, timeout=10.0)
                if r.status_code == 200:
                    deploys = r.json()
                    for item in deploys:
                        deploy_obj = item.get("deploy") if isinstance(item.get("deploy"), dict) else item
                        commit_info = deploy_obj.get("commit") if isinstance(deploy_obj.get("commit"), dict) else {}
                        c_id = commit_info.get("id") or commit_info.get("sha") or deploy_obj.get("commitId") or ""
                        if c_id.startswith(commit_sha) or commit_sha.startswith(c_id[:7]):
                            status = str(deploy_obj.get("status", "")).lower()
                            if status == "live":
                                await status_msg.edit_text(
                                    f"✅ *Render Deployment Live!*\n\n"
                                    f"📄 *File:* `{rel_path}`\n"
                                    f"💬 *Message:* {commit_msg}\n"
                                    f"🔗 *Commit SHA:* `{commit_sha}`\n\n"
                                    "🟢 Status: *Success (Live)*",
                                    parse_mode="Markdown"
                                )
                                await status_msg.reply_text(
                                    f"🔔 *Deployment Live Notification!*\n\n"
                                    f"✅ `{rel_path}` is deployed and live on Render!\n"
                                    f"🔗 Commit: `{commit_sha}`",
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
                                await status_msg.reply_text(
                                    f"⚠️ *Render Build Alert!*\nDeployment of `{rel_path}` failed ({status}).",
                                    parse_mode="Markdown"
                                )
                                return
        except Exception as e:
            logger.warning(f"Error polling Render: {e}")

    await status_msg.reply_text(
        f"ℹ️ *Deployment Poller Timed Out (5m)*\n\nCommit `{commit_sha}` (`{rel_path}`) was pushed to GitHub. Please check Render dashboard if the build is still processing.",
        parse_mode="Markdown"
    )

async def handle_push_drive(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Telegram command handler for /push_drive <drive_target> <repo_path> [commit_message]"""
    if not update.message or not update.message.text:
        return

    user_id = str(update.effective_user.id)
    if user_id != str(ADMIN_CHAT_ID):
        return

    args = context.args or []
    if len(args) < 2:
        await update.message.reply_text(
            "ℹ️ *Usage:*\n`/push_drive <drive_link_or_id> <target_repo_path> [commit_message]`\n\n"
            "*Example:*\n`/push_drive https://docs.google.com/document/d/1B9UYp.../edit bot.py Update bot.py`",
            parse_mode="Markdown"
        )
        return

    drive_target = args[0]
    rel_path = args[1].lstrip("/")
    commit_msg = " ".join(args[2:]) if len(args) > 2 else f"Update {rel_path} from Google Drive"

    status_msg = await update.message.reply_text("⏳ Resolving Google Drive file...", parse_mode="Markdown")

    try:
        file_id = extract_drive_file_id(drive_target)
        if not file_id:
            await status_msg.edit_text("❌ Could not extract valid Google Drive file ID from link.")
            return

        await status_msg.edit_text(f"⏳ Downloading `{file_id}` from Google Drive...", parse_mode="Markdown")
        content = await fetch_drive_file_content(file_id)

        await status_msg.edit_text(f"⏳ Committing `{rel_path}` to GitHub...", parse_mode="Markdown")
        result = await push_to_github(rel_path, content, commit_msg)
        commit_sha = result["commit_sha"]

        await status_msg.edit_text(
            f"🚀 *Commit Pushed Successfully!*\n\n"
            f"📄 *File:* `{rel_path}`\n"
            f"💬 *Message:* {commit_msg}\n"
            f"🔗 *Commit SHA:* `{commit_sha}`\n\n"
            "⏳ *Render deployment in progress...*",
            parse_mode="Markdown"
        )
        asyncio.create_task(poll_render_deploy(status_msg, commit_sha, rel_path, commit_msg))

    except Exception as e:
        logger.error(f"Error during push_drive: {e}")
        await status_msg.edit_text(f"❌ *Failed to push file:*\n`{str(e)}`", parse_mode="Markdown")

def get_command_handler():
    """Returns the telegram CommandHandler instance for /push_drive."""
    return CommandHandler("push_drive", handle_push_drive)
