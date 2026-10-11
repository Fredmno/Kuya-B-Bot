import os
import json
import base64
import asyncio
import logging
import httpx
from telegram import Update
from telegram.ext import ContextTypes

from .render_watcher import poll_render_deploy

logger = logging.getLogger(__name__)

ADMIN_CHAT_ID = os.environ.get("ADMIN_CHAT_ID", "7698531657")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "Fredmno/Kuya-B-Bot")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")

def get_clean_repo():
    repo = GITHUB_REPO or ""
    if "github.com/" in repo:
        repo = repo.split("github.com/")[-1].replace(".git", "").strip("/")
    return repo.strip()

def clean_json_text(raw_text: str) -> str:
    """Strips markdown code fences like ```json ... ```"""
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text

async def handle_json_commit_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Message handler that catches incoming JSON payloads in Telegram DMs
    and commits them directly to GitHub.
    """
    if not update.message or not update.message.text:
        return

    # Security check: Must match ADMIN_CHAT_ID
    user_id = str(update.effective_user.id)
    if user_id != str(ADMIN_CHAT_ID):
        return

    raw_text = clean_json_text(update.message.text)
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
