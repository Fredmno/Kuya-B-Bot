import os
import base64
import httpx
from starlette.requests import Request
from starlette.responses import JSONResponse

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = os.getenv("GITHUB_REPO")  # e.g., "username/repo"
GITHUB_BRANCH = os.getenv("GITHUB_BRANCH", "main")
ADMIN_USER_ID = os.getenv("ADMIN_USER_ID")


def _get_headers():
    return {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


async def api_admin_get_repo_tree(request: Request):
    """Fetches the complete recursive file tree of the GitHub repo."""
    if not GITHUB_TOKEN or not GITHUB_REPO:
        return JSONResponse({"error": "GitHub credentials not configured"}, status_code=500)

    url = f"https://api.github.com/repos/{GITHUB_REPO}/git/trees/{GITHUB_BRANCH}?recursive=1"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(url, headers=_get_headers())
            if res.status_code != 200:
                return JSONResponse({"error": f"GitHub API error: {res.text}"}, status_code=res.status_code)

            data = res.json()
            tree = data.get("tree", [])

            # Exclude build caches, git internals, and raw media
            ignored_prefixes = (".git", "__pycache__", ".pytest_cache", "venv", ".env")
            ignored_exts = (".png", ".jpg", ".jpeg", ".webp", ".mp4", ".ico", ".pyc")

            files = [
                item["path"]
                for item in tree
                if item.get("type") == "blob"
                and not any(item["path"].startswith(p) for p in ignored_prefixes)
                and not any(item["path"].endswith(ext) for ext in ignored_exts)
            ]
            files.sort()
            return JSONResponse({"success": True, "files": files})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_admin_get_file_content(request: Request):
    """Fetches the current file content from GitHub to populate the editor."""
    file_path = request.query_params.get("path", "").strip().lstrip("/")
    if not file_path:
        return JSONResponse({"error": "Path required"}, status_code=400)

    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{file_path}?ref={GITHUB_BRANCH}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(url, headers=_get_headers())
            if res.status_code != 200:
                return JSONResponse({"error": "File not found or unreadable"}, status_code=res.status_code)

            data = res.json()
            raw_b64 = data.get("content", "")
            decoded = base64.b64decode(raw_b64).decode("utf-8", errors="replace")
            return JSONResponse({"success": True, "content": decoded, "sha": data.get("sha")})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def commit_file_to_github(file_path: str, new_content: str, commit_message: str):
    """Uses GitHub REST API to create or update a file and commit it."""
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{file_path}"
    headers = _get_headers()

    async with httpx.AsyncClient(timeout=15.0) as client:
        sha = None
        get_res = await client.get(url, headers=headers, params={"ref": GITHUB_BRANCH})
        if get_res.status_code == 200:
            sha = get_res.json().get("sha")

        encoded_content = base64.b64encode(new_content.encode("utf-8")).decode("utf-8")

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
    """Endpoint handling file commit requests from the Mini App."""
    try:
        data = await request.json()
        file_path = data.get("file_path", "").strip().lstrip("/")
        content = data.get("content", "")
        message = data.get("message", "").strip()

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
