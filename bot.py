import json
import base64
import os
import httpx
from telegram import Update
from telegram.ext import ContextTypes, MessageHandler, filters

ADMIN_CHAT_ID = os.environ.get("ADMIN_CHAT_ID", "7698531657")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "alfredodimaano/Kuya-B-Bot-1")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")

def get_clean_repo():
    repo = GITHUB_REPO
    if "github.com/" in repo:
        repo = repo.split("github.com/")[-1].replace(".git", "").strip("/")
    return repo.strip()

async def admin_json_committer_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Listens for JSON commit payloads sent by the admin in Telegram chat."""
    if not update.message or not update.message.text:
        return

    # Check that message is from admin
    user_id = str(update.effective_user.id)
    if user_id != str(ADMIN_CHAT_ID):
        return

    text = update.message.text.strip()

    # Strip markdown code blocks if wrapped in ```json ... ```
    if text.startswith("```"):
        lines = text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    # Check if text is a commit JSON payload
    if not (text.startswith("{") and text.endswith("}")):
        return

    try:
        data = json.loads(text)
    except Exception:
        return  # Not valid JSON, ignore normal chat

    # Require action or target path
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
        "User-Agent": "KuyaB-Bot"
    }
    api_url = f"[https://api.github.com/repos/](https://api.github.com/repos/){repo}/contents/{rel_path}"

    try:
        async with httpx.AsyncClient() as client:
            # 1. Fetch current file SHA if file already exists
            sha = None
            get_res = await client.get(f"{api_url}?ref={branch}", headers=headers, timeout=12.0)
            if get_res.status_code == 200:
                sha = get_res.json().get("sha")

            # 2. Encode content to Base64
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
                await status_msg.edit_text(f"❌ *GitHub API Error (HTTP {put_res.status_code}):*\n`{err_msg}`", parse_mode="Markdown")

    except Exception as e:
        await status_msg.edit_text(f"❌ *Commit Failed:* `{str(e)}`", parse_mode="Markdown")
