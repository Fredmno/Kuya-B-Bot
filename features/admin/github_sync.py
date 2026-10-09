import os
import base64
import httpx
from starlette.requests import Request
from starlette.responses import JSONResponse

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = os.getenv("GITHUB_REPO")  # format: "username/repo"
GITHUB_BRANCH = os.getenv("GITHUB_BRANCH", "main")
ADMIN_USER_ID = os.getenv("ADMIN_USER_ID")


async def commit_file_to_github(file_path: str, new_content: str, commit_message: str):
    """Uses GitHub REST API to create or update a file and commit it."""
    if not GITHUB_TOKEN or not GITHUB_REPO:
        raise ValueError("GITHUB_TOKEN or GITHUB_REPO environment variables not set.")

    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{file_path}"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. Check if file already exists to get its current SHA
        sha = None
        get_res = await client.get(url, headers=headers, params={"ref": GITHUB_BRANCH})
        if get_res.status_code == 200:
            sha = get_res.json().get("sha")

        # 2. Base64 encode the content
        encoded_content = base64.b64encode(new_content.encode("utf-8")).decode("utf-8")

        # 3. Create or update file commit
        payload = {
            "message": commit_message or f"Auto-update: {file_path}",
            "content": encoded_content,
            "branch": GITHUB_BRANCH,
        }
        if sha:
            payload["sha"] = sha

        put_res = await client.put(url, headers=headers, json=payload)
        if put_res.status_code not in (200, 201):
            raise Exception(f"GitHub Error ({put_res.status_code}): {put_res.text}")

        return put_res.json()


async def api_admin_commit_file(request: Request):
    """Endpoint handling the web form submission."""
    try:
        data = await request.json()
        file_path = data.get("file_path", "").strip().lstrip("/")
        content = data.get("content", "")
        message = data.get("message", "").strip()
        user_id = str(data.get("user_id", ""))

        # Security check: only allow admin
        if ADMIN_USER_ID and user_id != str(ADMIN_USER_ID):
            return JSONResponse({"error": "Unauthorized"}, status_code=403)

        if not file_path:
            return JSONResponse({"error": "File path is required."}, status_code=400)

        result = await commit_file_to_github(file_path, content, message)
        commit_hash = result.get("commit", {}).get("sha", "")[:7]

        return JSONResponse({
            "success": True,
            "commit": commit_hash,
            "message": f"Successfully committed {file_path} ({commit_hash})! Render will now auto-deploy."
        })
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
