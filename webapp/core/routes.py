import os
import sys
import json
import base64
import httpx
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from starlette.requests import Request
from starlette.responses import JSONResponse

# Determine true project root directory
CURRENT_FILE = os.path.abspath(__file__)
CORE_DIR = os.path.dirname(CURRENT_FILE)
WEBAPP_DIR = os.path.abspath(os.path.join(CORE_DIR, ".."))
SRC_DIR = os.path.abspath(os.path.join(WEBAPP_DIR, ".."))

if os.path.exists(os.path.join(SRC_DIR, "bot.py")):
    REPO_ROOT = SRC_DIR
elif os.path.exists(os.path.join(os.path.dirname(SRC_DIR), "src", "bot.py")):
    REPO_ROOT = os.path.join(os.path.dirname(SRC_DIR), "src")
else:
    REPO_ROOT = SRC_DIR

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
    file_list = []
    exclude_dirs = {".git", "__pycache__", ".pytest_cache", "venv", ".venv", "node_modules", ".cache"}
    valid_exts = (".py", ".html", ".css", ".js", ".json", ".md", ".txt", ".yml", ".yaml", ".sh")

    for root, dirs, files in os.walk(REPO_ROOT):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for f in files:
            if f.endswith(valid_exts):
                rel = os.path.relpath(os.path.join(root, f), REPO_ROOT).replace("\\", "/")
                file_list.append(rel)

    file_list.sort()
    return file_list

# --- Committer Endpoints ---
async def repo_tree_endpoint(request: Request):
    """
    Feeds the Committer file dropdown using the same mechanism as the Tree & Deploy views:
    1. Loads from cached repo_tree.json if present.
    2. Falls back to GitHub API git/trees endpoint.
    3. Falls back to local disk scan.
    """
    files = []
    source = "cache_json"

    # 1. Try reading pre-generated tree json
    if os.path.exists(TREE_JSON_PATH):
        try:
            with open(TREE_JSON_PATH, "r", encoding="utf-8") as fp:
                data = json.load(fp)
                if isinstance(data, dict) and "files" in data:
                    raw_files = data["files"]
                    for item in raw_files:
                        if isinstance(item, dict) and "file" in item:
                            files.append(item["file"])
                        elif isinstance(item, str):
                            files.append(item)
                    if files:
                        files = sorted(list(set(files)))
                        return JSONResponse({"files": files, "ok": True, "count": len(files), "source": source})
        except Exception as e:
            print(f"Error reading {TREE_JSON_PATH}: {e}")

    # 2. Try GitHub git/trees API
    token = os.environ.get("GITHUB_TOKEN")
    repo = get_clean_repo()
    branch = os.environ.get("GITHUB_BRANCH", "main")

    if token:
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "KuyaB-Bot"
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
                    source = "github_api"
        except Exception as e:
            print(f"GitHub API tree fetch failed: {e}")

    # 3. Fallback to scanning local container files
    if not files:
        files = get_disk_files()
        source = "disk"

    return JSONResponse({"files": files, "ok": True, "count": len(files), "source": source})

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
            "User-Agent": "KuyaB-Bot"
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
        "User-Agent": "KuyaB-Bot"
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

    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "KuyaB-Bot"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    recent_files = {}

    try:
        async with httpx.AsyncClient() as client:
            commits_url = f"https://api.github.com/repos/{repo}/commits?sha={branch}&per_page=12"
            res = await client.get(commits_url, headers=headers, timeout=12.0)
            if res.status_code != 200:
                return {"ok": False, "error": f"GitHub API error: {res.text}"}

            commits = res.json()
            if not isinstance(commits, list):
                return {"ok": False, "error": "Invalid commits format"}

            for c in commits:
                sha = c.get("sha", "")[:7]
                commit_meta = c.get("commit", {})
                author_name = commit_meta.get("author", {}).get("name", "GitHub")
                date_str = commit_meta.get("author", {}).get("date", "")[:16].replace("T", " ")
                msg = commit_meta.get("message", "No message")

                detail_url = f"https://api.github.com/repos/{repo}/commits/{c.get('sha')}"
                c_detail_res = await client.get(detail_url, headers=headers, timeout=12.0)
                if c_detail_res.status_code == 200:
                    detail_data = c_detail_res.json()
                    for f in detail_data.get("files", []):
                        fname = f.get("filename", "")
                        if fname not in recent_files:
                            patch_preview = f.get("patch", "")
                            if patch_preview and len(patch_preview) > 350:
                                patch_preview = patch_preview[:350] + "..."
                            elif not patch_preview:
                                patch_preview = "Binary / No diff preview"

                            recent_files[fname] = {
                                "file": fname,
                                "status": f.get("status", "modified"),
                                "additions": f.get("additions", 0),
                                "deletions": f.get("deletions", 0),
                                "commit": sha,
                                "author": author_name,
                                "date": date_str,
                                "message": msg,
                                "patch": patch_preview
                            }

        latest_date = commits[0]["commit"]["author"]["date"][:16].replace("T", " ") if commits else "N/A"
        tree_data = {
            "last_updated": latest_date,
            "files": list(recent_files.values())
        }

        os.makedirs(TREE_DIR, exist_ok=True)
        with open(TREE_JSON_PATH, "w", encoding="utf-8") as fp:
            json.dump(tree_data, fp, indent=2)

        return {"ok": True, "data": tree_data}
    except Exception as e:
        return {"ok": False, "error": str(e)}

async def get_tree_endpoint(request: Request):
    if os.path.exists(TREE_JSON_PATH):
        try:
            with open(TREE_JSON_PATH, "r", encoding="utf-8") as fp:
                data = json.load(fp)
            return JSONResponse({"ok": True, "data": data})
        except Exception:
            pass

    res = await generate_and_save_tree()
    return JSONResponse(res)

async def regenerate_tree_endpoint(request: Request):
    res = await generate_and_save_tree()
    return JSONResponse(res)

# --- Deployments Endpoint ---
async def get_deployments_endpoint(request: Request):
    token = os.environ.get("GITHUB_TOKEN")
    repo = get_clean_repo()
    branch = os.environ.get("GITHUB_BRANCH", "main")

    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "KuyaB-Bot"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    url = f"https://api.github.com/repos/{repo}/commits?sha={branch}&per_page=12"
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=headers, timeout=12.0)
            if res.status_code == 200:
                raw_commits = res.json()
                deployments = []

                for idx, item in enumerate(raw_commits):
                    commit_info = item.get("commit", {})
                    author_info = commit_info.get("author", {})
                    sha = item.get("sha", "")
                    short_sha = sha[:7]
                    raw_msg = commit_info.get("message", "No commit message").strip()
                    first_line = raw_msg.splitlines()[0] if raw_msg else "Update"
                    date_str = author_info.get("date", "")[:16].replace("T", " ") if author_info.get("date") else "Recent"

                    files_changed = []
                    detail_url = f"https://api.github.com/repos/{repo}/commits/{sha}"
                    try:
                        detail_res = await client.get(detail_url, headers=headers, timeout=6.0)
                        if detail_res.status_code == 200:
                            detail_json = detail_res.json()
                            for f in detail_json.get("files", []):
                                files_changed.append({
                                    "filename": f.get("filename", ""),
                                    "status": f.get("status", "modified"),
                                    "additions": f.get("additions", 0),
                                    "deletions": f.get("deletions", 0),
                                    "patch": f.get("patch", "")
                                })
                    except Exception:
                        pass

                    deployments.append({
                        "id": f"commit-{short_sha}",
                        "name": f"Deploy: {first_line[:40]}",
                        "date": date_str,
                        "status": "Live" if idx == 0 else "Success",
                        "commit": short_sha,
                        "author": author_info.get("name", "GitHub"),
                        "message": raw_msg,
                        "files": files_changed
                    })

                return JSONResponse({"deployments": deployments, "ok": True})
            return JSONResponse({"deployments": [], "error": res.text, "ok": False}, status_code=res.status_code)
    except Exception as e:
        return JSONResponse({"deployments": [], "error": str(e), "ok": False}, status_code=500)

async def webhook_dummy(request: Request):
    return JSONResponse({"status": "received", "ok": True})

# --- Route Registry ---
def get_all_routes(health_check_handler=None, telegram_webhook_handler=None, webhook_path="/webhook"):
    routes = [
        Route("/app", endpoint=serve_index, methods=["GET"]),
        Mount("/app/core", StaticFiles(directory=CORE_DIR), name="core"),

        # Deployments
        Route("/api/deployment-history", endpoint=get_deployments_endpoint, methods=["GET"]),
        Route("/app/api/deployment-history", endpoint=get_deployments_endpoint, methods=["GET"]),
        Route("/api/github-webhook", endpoint=webhook_dummy, methods=["POST"]),
        Route("/api/render-webhook", endpoint=webhook_dummy, methods=["POST"]),

        # Committer Endpoints
        Route("/api/repo-tree", endpoint=repo_tree_endpoint, methods=["GET"]),
        Route("/app/api/repo-tree", endpoint=repo_tree_endpoint, methods=["GET"]),
        Route("/api/file-content", endpoint=file_content_endpoint, methods=["GET"]),
        Route("/app/api/file-content", endpoint=file_content_endpoint, methods=["GET"]),
        Route("/api/commit-file", endpoint=commit_file_endpoint, methods=["POST"]),
        Route("/app/api/commit-file", endpoint=commit_file_endpoint, methods=["POST"]),
        Route("/api/commit", endpoint=commit_file_endpoint, methods=["POST"]),
        Route("/app/api/commit", endpoint=commit_file_endpoint, methods=["POST"]),

        # Tree Endpoints
        Route("/api/repo-tree-details", endpoint=get_tree_endpoint, methods=["GET"]),
        Route("/app/api/repo-tree-details", endpoint=get_tree_endpoint, methods=["GET"]),
        Route("/api/regenerate-tree", endpoint=regenerate_tree_endpoint, methods=["POST"]),
        Route("/app/api/regenerate-tree", endpoint=regenerate_tree_endpoint, methods=["POST"]),
    ]

    features_dir = os.path.join(WEBAPP_DIR, "features")
    modules_dir = os.path.join(WEBAPP_DIR, "modules")
    root_dashboard_dir = os.path.join(WEBAPP_DIR, "dashboard")

    if os.path.exists(features_dir):
        routes.append(Mount("/app/features", StaticFiles(directory=features_dir), name="features"))
    if os.path.exists(modules_dir):
        routes.append(Mount("/app/modules", StaticFiles(directory=modules_dir), name="modules"))
    if os.path.exists(root_dashboard_dir):
        routes.append(Mount("/app/dashboard", StaticFiles(directory=root_dashboard_dir), name="root_dashboard"))

    if health_check_handler:
        routes.append(Route("/health", endpoint=health_check_handler, methods=["GET"]))

    if telegram_webhook_handler:
        routes.append(Route(webhook_path, endpoint=telegram_webhook_handler, methods=["POST"]))

    return routes
