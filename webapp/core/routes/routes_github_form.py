import os
import base64
import asyncio
import httpx
from starlette.routing import Route
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.background import BackgroundTask

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "Fredmno/Kuya-B-Bot")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")
RENDER_API_KEY = os.environ.get("RENDER_API_KEY")
RENDER_SERVICE_ID = os.environ.get("RENDER_SERVICE_ID", "srv-d8vn7n6rnols73dtbf00")
BOT_TOKEN = os.environ.get("BOT_TOKEN")
ADMIN_CHAT_ID = os.environ.get("ADMIN_CHAT_ID")

def get_clean_repo():
    repo = GITHUB_REPO
    if "github.com/" in repo:
        repo = repo.split("github.com/")[-1].replace(".git", "").strip("/")
    return repo.strip()

async def send_tg_message(text: str) -> int:
    if not BOT_TOKEN or not ADMIN_CHAT_ID:
        return 0
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {"chat_id": ADMIN_CHAT_ID, "text": text, "parse_mode": "Markdown"}
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=payload, timeout=8.0)
            if res.status_code == 200:
                return res.json().get("result", {}).get("message_id", 0)
    except Exception:
        pass
    return 0

async def edit_tg_message(message_id: int, text: str):
    if not BOT_TOKEN or not ADMIN_CHAT_ID or not message_id:
        return
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/editMessageText"
    payload = {"chat_id": ADMIN_CHAT_ID, "message_id": message_id, "text": text, "parse_mode": "Markdown"}
    try:
        async with httpx.AsyncClient() as client:
            await client.post(url, json=payload, timeout=8.0)
    except Exception:
        pass

async def monitor_render_deployment(commit_sha: str, file_path: str, commit_msg: str):
    init_text = (
        f"🚀 *GitHub Commit Pushed*\n\n"
        f"📄 *File:* `{file_path}`\n"
        f"💬 *Message:* {commit_msg}\n"
        f"🏷️ *Commit:* `{commit_sha}`\n\n"
        f"⏳ *Render deployment in progress...*"
    )
    msg_id = await send_tg_message(init_text)

    if not (RENDER_API_KEY and RENDER_SERVICE_ID):
        return

    render_headers = {"Authorization": f"Bearer {RENDER_API_KEY}", "Accept": "application/json"}
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
                                finish_text = (
                                    f"✅ *Render Deployment Live!*\n\n"
                                    f"📄 *File:* `{file_path}`\n"
                                    f"💬 *Message:* {commit_msg}\n"
                                    f"🏷️ *Commit:* `{commit_sha}`\n\n"
                                    f"🟢 Status: *Success (Live)*"
                                )
                                if msg_id:
                                    await edit_tg_message(msg_id, finish_text)
                                else:
                                    await send_tg_message(finish_text)
                                return
                            elif status in ("build_failed", "update_failed", "canceled"):
                                fail_text = (
                                    f"❌ *Render Deployment Failed*\n\n"
                                    f"📄 *File:* `{file_path}`\n"
                                    f"🏷️ *Commit:* `{commit_sha}`\n\n"
                                    f"⚠️ Status: *{status.replace('_', ' ').title()}*"
                                )
                                if msg_id:
                                    await edit_tg_message(msg_id, fail_text)
                                else:
                                    await send_tg_message(fail_text)
                                return
        except Exception:
            pass

async def commit_file_endpoint(request: Request):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body", "ok": False}, status_code=400)

    content_str = data.get("content", "")
    rel_path = (data.get("file_path") or data.get("path") or "").strip().lstrip("/")
    commit_msg = (data.get("commit_message") or data.get("message") or f"Update {rel_path}").strip()

    if not rel_path:
        return JSONResponse({"error": "Target file path is required", "ok": False}, status_code=400)

    token = GITHUB_TOKEN
    repo = get_clean_repo()
    branch = GITHUB_BRANCH

    if not token:
        return JSONResponse({"error": "GITHUB_TOKEN is missing on server", "ok": False}, status_code=500)

    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json", "User-Agent": "KuyaB-Bot-App"}
    api_url = f"https://api.github.com/repos/{repo}/contents/{rel_path}"

    try:
        async with httpx.AsyncClient() as client:
            sha = None
            get_res = await client.get(f"{api_url}?ref={branch}", headers=headers, timeout=12.0)
            if get_res.status_code == 200:
                sha = get_res.json().get("sha")

            encoded_content = base64.b64encode(content_str.encode("utf-8")).decode("utf-8")
            payload = {"message": commit_msg, "content": encoded_content, "branch": branch}
            if sha:
                payload["sha"] = sha

            put_res = await client.put(api_url, json=payload, headers=headers, timeout=20.0)
            if put_res.status_code in (200, 201):
                commit_sha = put_res.json().get("commit", {}).get("sha", "")[:7]
                bg_task = BackgroundTask(monitor_render_deployment, commit_sha, rel_path, commit_msg)
                return JSONResponse(
                    {"ok": True, "sha": commit_sha, "message": f"Committed {rel_path} ({commit_sha})"},
                    background=bg_task
                )
            return JSONResponse({"error": f"GitHub API: {put_res.text}", "ok": False}, status_code=put_res.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e), "ok": False}, status_code=500)

def get_routes():
    return [
        Route("/api/commit-file", endpoint=commit_file_endpoint, methods=["POST"]),
        Route("/api/commit", endpoint=commit_file_endpoint, methods=["POST"]),
        Route("/app/api/commit-file", endpoint=commit_file_endpoint, methods=["POST"]),
        Route("/app/api/commit", endpoint=commit_file_endpoint, methods=["POST"]),
    ]
