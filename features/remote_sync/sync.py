import os
import base64
import logging
import httpx
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = os.getenv("GITHUB_REPO")
GITHUB_BRANCH = os.getenv("GITHUB_BRANCH", "main")
SYNC_KEY = os.getenv("SYNC_KEY")


def _get_github_headers():
    return {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


async def _commit_content(file_path: str, content: str, message: str):
    """Pushes the payload directly to the GitHub repository."""
    if not GITHUB_TOKEN or not GITHUB_REPO:
        raise ValueError("GitHub credentials (GITHUB_TOKEN, GITHUB_REPO) are missing.")

    headers = _get_github_headers()
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{file_path}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Check if the target file already exists to retrieve its blob sha
        sha = None
        get_res = await client.get(f"{url}?ref={GITHUB_BRANCH}", headers=headers)
        if get_res.status_code == 200:
            sha = get_res.json().get("sha")

        encoded_content = base64.b64encode(content.encode("utf-8")).decode("utf-8")
        payload = {
            "message": message,
            "content": encoded_content,
            "branch": GITHUB_BRANCH,
        }
        if sha:
            payload["sha"] = sha

        put_res = await client.put(url, headers=headers, json=payload)
        if put_res.status_code not in (200, 201):
            raise Exception(f"GitHub API Error ({put_res.status_code}): {put_res.text}")

        return put_res.json()


async def api_remote_sync_file(request: Request):
    """
    POST /api/admin/remote-sync
    Headers:
      X-Sync-Key: <SYNC_KEY>
      Content-Type: application/json
    Body:
      {
        "file_path": "path/to/file.py",
        "content": "...",
        "message": "Commit message"
      }
    """
    client_key = request.headers.get("X-Sync-Key") or request.query_params.get("key")
    configured_key = os.getenv("SYNC_KEY")

    if not configured_key or client_key != configured_key:
        return JSONResponse({"error": "Unauthorized: Invalid or missing sync key"}, status_code=401)

    try:
        data = await request.json()
        file_path = data.get("file_path", "").strip()
        content = data.get("content", "")
        commit_message = data.get("message", "").strip() or f"Remote sync: {file_path}"

        if not file_path:
            return JSONResponse({"error": "Missing file_path in payload"}, status_code=400)

        result = await _commit_content(file_path, content, commit_message)
        commit_sha = result.get("commit", {}).get("sha", "unknown")
        
        logger.info(f"[Remote Sync] Pushed {file_path} (commit: {commit_sha})")
        return JSONResponse({
            "success": True,
            "message": f"Updated {file_path}. Render deploy triggered 🚀",
            "commit": commit_sha
        })

    except Exception as e:
        logger.error(f"[Remote Sync Error]: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)
