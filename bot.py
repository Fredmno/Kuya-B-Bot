import os
import sys
import json
import base64
import httpx
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from starlette.requests import Request
from starlette.responses import JSONResponse

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
GITHUB_REPO = os.environ.get("GITHUB_REPO", "Fredmno/Kuya-B-Bot")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")

def get_clean_repo():
    repo = GITHUB_REPO
    if "github.com/" in repo:
        repo = repo.split("github.com/")[-1].replace(".git", "").strip("/")
    return repo.strip()

def get_disk_files():
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

async def repo_tree_endpoint(request: Request):
    token = os.environ.get("GITHUB_TOKEN")
    repo = get_clean_repo()
    branch = os.environ.get("GITHUB_BRANCH", "main")
    files = []

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
                        return JSONResponse({"files": sorted(list(set(files))), "ok": True})
        except Exception:
            pass

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
                    if files:
                        return JSONResponse({"files": sorted(files), "ok": True})
        except Exception:
            pass

    files = get_disk_files()
    return JSONResponse({"files": files, "ok": True})

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
    """Handles updating or creating files on GitHub directly from the Mini App."""
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body", "ok": False}, status_code=400)

    rel_path = (data.get("file_path") or data.get("path") or "").strip().lstrip("/")
    commit_msg = (data.get("commit_message") or data.get("message") or "").strip()
    content_str = data.get("content", "")

    if not rel_path:
        return JSONResponse({"error": "Target file path is required", "ok": False}, status_code=400)
    if not commit_msg:
        commit_msg = f"Update {rel_path}"

    token = os.environ.get("GITHUB_TOKEN")
    repo = get_clean_repo()
    branch = os.environ.get("GITHUB_BRANCH", "main")

    if not token:
        return JSONResponse({"error": "GITHUB_TOKEN is missing on server", "ok": False}, status_code=500)

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "KuyaB-Bot-App"
    }
    api_url = f"https://api.github.com/repos/{repo}/contents/{rel_path}"

    try:
        async with httpx.AsyncClient() as client:
            sha = None
            # Check if updating an existing file
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
                res_data = put_res.json()
                commit_sha = res_data.get("commit", {}).get("sha", "")[:7]
                return JSONResponse({
                    "ok": True,
                    "sha": commit_sha,
                    "message": f"Successfully committed {rel_path} ({commit_sha})"
                })
            else:
                try:
                    err_msg = put_res.json().get("message", put_res.text)
                except Exception:
                    err_msg = put_res.text
                return JSONResponse({"error": f"GitHub API: {err_msg}", "ok": False}, status_code=put_res.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e), "ok": False}, status_code=500)

async def webhook_dummy(request: Request):
    return JSONResponse({"status": "received", "ok": True})

def get_all_routes(health_check_handler=None, telegram_webhook_handler=None, webhook_path="/webhook"):
    routes = [
        Route("/app", endpoint=serve_index, methods=["GET"]),
        Mount("/app/core", StaticFiles(directory=CORE_DIR), name="core"),

        # Committer Endpoints
        Route("/api/repo-tree", endpoint=repo_tree_endpoint, methods=["GET"]),
        Route("/app/api/repo-tree", endpoint=repo_tree_endpoint, methods=["GET"]),
        Route("/api/file-content", endpoint=file_content_endpoint, methods=["GET"]),
        Route("/app/api/file-content", endpoint=file_content_endpoint, methods=["GET"]),
        Route("/api/commit-file", endpoint=commit_file_endpoint, methods=["POST"]),
        Route("/app/api/commit-file", endpoint=commit_file_endpoint, methods=["POST"]),
    ]

    committer_dir = os.path.join(WEBAPP_DIR, "committer")
    features_dir = os.path.join(WEBAPP_DIR, "features")
    modules_dir = os.path.join(WEBAPP_DIR, "modules")

    if os.path.exists(committer_dir):
        routes.append(Mount("/app/committer", StaticFiles(directory=committer_dir), name="committer"))
    if os.path.exists(features_dir):
        routes.append(Mount("/app/features", StaticFiles(directory=features_dir), name="features"))
    if os.path.exists(modules_dir):
        routes.append(Mount("/app/modules", StaticFiles(directory=modules_dir), name="modules"))

    if health_check_handler:
        routes.append(Route("/health", endpoint=health_check_handler, methods=["GET"]))
    if telegram_webhook_handler:
        routes.append(Route(webhook_path, endpoint=telegram_webhook_handler, methods=["POST"]))

    return routes
