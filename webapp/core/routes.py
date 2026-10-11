import os
import sys
import json
import base64
import httpx
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from starlette.requests import Request
from starlette.responses import JSONResponse

WEBAPP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CORE_DIR = os.path.join(WEBAPP_DIR, "core")
BASE_DIR = os.path.abspath(os.path.join(WEBAPP_DIR, ".."))
TREE_DIR = os.path.join(WEBAPP_DIR, "features", "tree")
TREE_JSON_PATH = os.path.join(TREE_DIR, "repo_tree.json")

for p in [BASE_DIR, WEBAPP_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from webapp.core.index_consolidator import serve_index
except ImportError:
    try:
        from core.index_consolidator import serve_index
    except ImportError:
        from index_consolidator import serve_index

# Environment Variables
BOT_TOKEN = os.environ.get("BOT_TOKEN")
ADMIN_CHAT_ID = "7698531657"
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "alfredodimaano/Kuya-B-Bot-1")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")
RENDER_API_KEY = os.environ.get("RENDER_API_KEY")
RENDER_SERVICE_ID = os.environ.get("RENDER_SERVICE_ID")

LOCAL_DEPLOYS = []

def get_clean_repo():
    repo = os.environ.get("GITHUB_REPO", "alfredodimaano/Kuya-B-Bot-1")
    if "github.com/" in repo:
        repo = repo.split("github.com/")[-1].replace(".git", "").strip("/")
    return repo

# --- Committer Handlers ---
async def repo_tree_endpoint(request: Request):
    token = os.environ.get("GITHUB_TOKEN")
    repo = get_clean_repo()
    branch = os.environ.get("GITHUB_BRANCH", "main")

    if not token:
        file_list = []
        exclude = {".git", "__pycache__", ".pytest_cache", "venv", ".venv"}
        for root, dirs, files in os.walk(BASE_DIR):
            dirs[:] = [d for d in dirs if d not in exclude]
            for f in files:
                if f.endswith((".py", ".html", ".css", ".js", ".json", ".md")):
                    rel = os.path.relpath(os.path.join(root, f), BASE_DIR).replace("\\", "/")
                    file_list.append(rel)
        file_list.sort()
        return JSONResponse({"files": file_list, "ok": True})

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    url = f"https://api.github.com/repos/{repo}/git/trees/{branch}?recursive=1"
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=headers, timeout=12.0)
            if res.status_code == 200:
                data = res.json()
                valid_exts = (".py", ".html", ".css", ".js", ".json", ".md", ".txt", ".yml")
                files = [
                    item["path"] for item in data.get("tree", [])
                    if item.get("type") == "blob" and item["path"].endswith(valid_exts)
                ]
                files.sort()
                return JSONResponse({"files": files, "ok": True})
            return JSONResponse({"error": res.text, "files": [], "ok": False}, status_code=res.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e), "files": [], "ok": False}, status_code=500)

async def file_content_endpoint(request: Request):
    rel_path = request.query_params.get("path", "").strip().lstrip("/")
    if not rel_path or ".." in rel_path:
        return JSONResponse({"error": "Invalid path", "ok": False}, status_code=400)

    token = os.environ.get("GITHUB_TOKEN")
    repo = get_clean_repo()
    branch = os.environ.get("GITHUB_BRANCH", "main")

    if token:
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json"
        }
        url = f"https://api.github.com/repos/{repo}/contents/{rel_path}?ref={branch}"
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, headers=headers, timeout=10.0)
                if res.status_code == 200:
                    data = res.json()
                    decoded = base64.b64decode(data.get("content", "")).decode("utf-8", errors="replace")
                    return JSONResponse({"content": decoded, "ok": True})
        except Exception:
            pass

    local_path = os.path.join(BASE_DIR, rel_path)
    if os.path.isfile(local_path):
        try:
            with open(local_path, "r", encoding="utf-8") as f:
                return JSONResponse({"content": f.read(), "ok": True})
        except Exception as e:
            return JSONResponse({"error": str(e), "ok": False}, status_code=500)

    return JSONResponse({"error": "File not found", "ok": False}, status_code=404)

async def
