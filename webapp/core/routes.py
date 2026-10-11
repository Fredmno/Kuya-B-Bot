import os
import sys
import json
import base64
import httpx
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from starlette.requests import Request
from starlette.responses import JSONResponse

# Resolve true project root on Render (/opt/render/project/src)
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
WEBAPP_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
CORE_DIR = CURRENT_DIR

def get_repo_root():
    candidate = os.path.abspath(os.path.join(CURRENT_DIR, "../.."))
    if os.path.exists(os.path.join(candidate, "bot.py")):
        return candidate
    candidate_up = os.path.abspath(os.path.join(CURRENT_DIR, "../../.."))
    if os.path.exists(os.path.join(candidate_up, "bot.py")):
        return candidate_up
    return candidate

REPO_ROOT = get_repo_root()
TREE_DIR = os.path.join(WEBAPP_DIR, "features", "tree")
TREE_JSON_PATH = os.path.join(TREE_DIR, "repo_tree.json")

for p in [REPO_ROOT, WEBAPP_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from webapp.core.index_consolidator import serve_index
except ImportError:
    try:
        from core.index_consolidator import serve_index
    except ImportError:
        from index_consolidator import serve_index

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "alfredodimaano/Kuya-B-Bot-1")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")

def get_clean_repo():
    repo = os.environ.get("GITHUB_REPO", "alfredodimaano/Kuya-B-Bot-1")
    if "github.com/" in repo:
        repo = repo.split("github.com/")[-1].replace(".git", "").strip("/")
    return repo.strip()

def get_disk_files():
    """Scans the local filesystem to guarantee a complete file list."""
    found = []
    exclude = {".git", "__pycache__", ".pytest_cache", "venv", ".venv", "node_modules", ".cache"}
    valid_exts = (".py", ".html", ".css", ".js", ".json", ".md", ".txt", ".yml", ".yaml", ".sh")
    
    for root, dirs, files in os.walk(REPO_ROOT):
        dirs[:] = [d for d in dirs if d not in exclude and not d.startswith(".")]
        for f in files:
            if f.endswith(valid_exts):
                rel = os.path.relpath(os.path.join(root, f), REPO_ROOT).replace("\\", "/")
                found.append(rel)
    found.sort()
    return found

# --- Committer Endpoints ---
async def repo_tree_endpoint(request: Request):
    """
    Feeds the committer file dropdown. Always returns 200 with files.
    """
    token = os.environ.get("GITHUB_TOKEN")
    repo = get_clean_repo()
    branch = os.environ.get("GITHUB_BRANCH", "main")
    files = []

    # 1. Try reading from cached repo_tree.json if available
    if os.path.exists(TREE_JSON_PATH):
        try:
            with open(TREE_JSON_PATH, "r", encoding="utf-8") as fp:
                data = json.load(fp)
                if isinstance(data, dict) and "files" in data:
                    for item in data["files"]:
                        if isinstance(item, dict) and "file" in item:
                            files.append(item["file"])
                        elif isinstance(item, str):
                            files.append(item)
                    if files:
                        files = sorted(list(set(files)))
                        return JSONResponse({"files": files, "ok": True, "count": len(files)})
        except Exception:
            pass

    # 2. Try GitHub Git Trees API with mandatory User-Agent
    if token:
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "KuyaB-Bot-App"
        }
        url = f"https://api.github.com/repos/{repo}/git/trees/{branch}?recursive=1"
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, headers=headers, timeout=10.0)
                if res.status_code == 200:
                    tree_data = res.json()
                    valid_exts = (".py", ".html", ".css", ".js", ".json", ".md", ".txt", ".yml", ".yaml", ".sh")
                    files = [
                        item["path"] for item in tree_data.get("tree", [])
                        if item.get("type") == "blob" and item["path"].endswith(valid_exts)
                    ]
                    files.sort()
                    if files:
                        return JSONResponse({"files": files, "ok": True, "count": len(files)})
        except Exception as e:
            print(f"GitHub API tree fetch failed: {e}")

    # 3. Always fallback to local disk files so this NEVER fails
    files = get_disk_files()
    return JSONResponse({"files": files, "ok": True, "count": len(files)})

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
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "KuyaB-Bot-App"
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

    local_path = os.path.join(REPO_ROOT, rel_path)
    if os.path.isfile(local_path):
        try:
            with open(local_path, "r", encoding="utf-8") as f:
                return JSONResponse({"content": f.read(), "ok": True})
        except Exception as e:
            return JSONResponse({"error": str(e), "ok": False}, status_code=500)

    return JSONResponse({"error": "File not found", "ok": False}, status_code=404)

async def commit_file_endpoint(request: Request):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body", "ok": False}, status_code=400)

    rel_path = (data.get("file_path") or data.get("path") or "").strip().lstrip("/")
    commit_msg = (data.get("commit_message") or data.get("message") or "").strip()
    content_str = data.get("content", "")

    if not rel_path or not commit_msg:
        return JSONResponse({"error": "File path and commit message are required", "ok": False}, status_code=400)

    token = os.environ.get("GITHUB_TOKEN")
    repo = get_clean_repo()
    branch = os.environ.get("GITHUB_BRANCH", "main")

    if not token:
        return JSONResponse({"error": "GITHUB_TOKEN is missing on Render", "ok": False}, status_code=500)

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "KuyaB-Bot-App"
    }
    api_url = f"https://api.github.com/repos/{repo}/contents/{rel_path}"

    try:
        async with httpx.AsyncClient() as client:
            sha = None
            get_res = await client.get(f"{api_url}?ref={branch}", headers=headers, timeout=10.0)
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

            put_res = await client.put(api_url, json=payload, headers=headers, timeout=15.0)
            if put_res.status_code in (200, 201):
                return JSONResponse({"ok": True, "message": "Commit pushed successfully"})
            else:
                try:
                    err_json = put_res.json()
                    err_msg = err_json.get("message", put_res.text)
                except Exception:
                    err_msg = put_res.text
                return JSONResponse({"error": f"GitHub API: {err_msg}", "ok": False}, status_code=put_res.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e), "ok": False}, status_code=500)

# --- Tree Feature Endpoints ---
async def generate_and_save_tree():
    token = os.environ.get("GITHUB_TOKEN")
    repo = get_clean_repo()
    branch = os.environ.get("GITHUB_BRANCH", "main")

    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "KuyaB-Bot-App"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    recent_files = {}

    try:
        async with httpx.AsyncClient() as client:
            commits_url = f"
