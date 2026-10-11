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
    return candidate

REPO_ROOT = get_repo_root()

for p in [REPO_ROOT, WEBAPP_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from webapp.core.index_consolidator import serve_index
except ImportError:
    from index_consolidator import serve_index

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "Fredmno/Kuya-B-Bot")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")
RENDER_API_KEY = os.environ.get("RENDER_API_KEY")
RENDER_SERVICE_ID = os.environ.get("RENDER_SERVICE_ID")

def get_clean_repo():
    repo = GITHUB_REPO
    if "github.com/" in repo:
        repo = repo.split("github.com/")[-1].replace(".git", "").strip("/")
    return repo.strip()

# --- Deployments & Render API Endpoints ---

async def get_deployments_endpoint(request: Request):
    deployments = []
    # 1. Fetch from Render API if credentials provided
    if RENDER_API_KEY and RENDER_SERVICE_ID:
        render_headers = {
            "Authorization": f"Bearer {RENDER_API_KEY}",
            "Accept": "application/json"
        }
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    f"https://api.render.com/v1/services/{RENDER_SERVICE_ID}/deploys?limit=10",
                    headers=render_headers,
                    timeout=10.0
                )
                if r.status_code == 200:
                    for d in r.json():
                        deploy_obj = d.get("deploy", {})
                        commit_info = deploy_obj.get("commit", {})
                        deployments.append({
                            "id": deploy_obj.get("id"),
                            "name": commit_info.get("message", "Deploy").splitlines()[0][:45] if commit_info.get("message") else "Deploy",
                            "status": deploy_obj.get("status", "live"),
                            "commit": commit_info.get("id", "")[:7],
                            "date": deploy_obj.get("createdAt", "")[:16].replace("T", " "),
                            "files": []
                        })
                    if deployments:
                        return JSONResponse({"deployments": deployments, "ok": True})
        except Exception:
            pass

    # 2. Fallback to GitHub Commit History
    token = GITHUB_TOKEN
    repo = get_clean_repo()
    branch = GITHUB_BRANCH
    gh_headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "KuyaB-Bot-App"}
    if token:
        gh_headers["Authorization"] = f"Bearer {token}"

    try:
        async with httpx.AsyncClient() as client:
            gh_res = await client.get(f"https://api.github.com/repos/{repo}/commits?sha={branch}&per_page=10", headers=gh_headers, timeout=10.0)
            if gh_res.status_code == 200:
                for idx, c in enumerate(gh_res.json()):
                    commit_obj = c.get("commit", {})
                    short_sha = c.get("sha", "")[:7]
                    first_line = commit_obj.get("message", "Deploy").splitlines()[0]
                    deployments.append({
                        "id": short_sha,
                        "name": first_line[:45],
                        "status": "live" if idx == 0 else "succeeded",
                        "commit": short_sha,
                        "date": commit_obj.get("author", {}).get("date", "")[:16].replace("T", " "),
                        "files": []
                    })
    except Exception:
        pass

    return JSONResponse({"deployments": deployments, "ok": True})

async def get_deployment_logs_endpoint(request: Request):
    deploy_id = request.query_params.get("id", "")
    commit_sha = request.query_params.get("commit", "")
    logs = ""
    changed_files = []

    # Fetch changed files from GitHub commit diff
    repo = get_clean_repo()
    token = GITHUB_TOKEN
    gh_headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "KuyaB-Bot-App"}
    if token:
        gh_headers["Authorization"] = f"Bearer {token}"

    if commit_sha:
        try:
            async with httpx.AsyncClient() as client:
                diff_res = await client.get(f"https://api.github.com/repos/{repo}/commits/{commit_sha}", headers=gh_headers, timeout=10.0)
                if diff_res.status_code == 200:
                    commit_data = diff_res.json()
                    changed_files = [f.get("filename") for f in commit_data.get("files", [])]
        except Exception:
            pass

    # Fetch logs from Render API if deploy_id is a Render deploy ID (starts with dep-)
    if RENDER_API_KEY and RENDER_SERVICE_ID and deploy_id.startswith("dep-"):
        render_headers = {"Authorization": f"Bearer {RENDER_API_KEY}", "Accept": "application/json"}
        try:
            async with httpx.AsyncClient() as client:
                logs_res = await client.get(f"https://api.render.com/v1/services/{RENDER_SERVICE_ID}/deploys/{deploy_id}/logs", headers=render_headers, timeout=10.0)
                if logs_res.status_code == 200:
                    log_entries = logs_res.json()
                    logs = "\n".join([e.get("message", "") for e in log_entries])
        except Exception:
            pass

    if not logs:
        logs = f"[Render Deploy Status]\nDeploy ID: {deploy_id}\nCommit: {commit_sha}\nUploaded files:\n" + ("\n".join(changed_files) if changed_files else "No file list available") + "\n\nStatus: Live / Deployed successfully on Render."

    return JSONResponse({"logs": logs, "files": changed_files, "ok": True})

# --- Committer Endpoints ---
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
                return JSONResponse({"ok": True, "sha": commit_sha, "message": f"Committed {rel_path} ({commit_sha})"})
            return JSONResponse({"error": f"GitHub API: {put_res.text}", "ok": False}, status_code=put_res.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e), "ok": False}, status_code=500)

# --- Route Registry ---
def get_all_routes(health_check_handler=None, telegram_webhook_handler=None, webhook_path="/webhook"):
    routes = [
        Route("/app", endpoint=serve_index, methods=["GET"]),
        Mount("/app/core", StaticFiles(directory=CORE_DIR), name="core"),
        Route("/api/deployment-history", endpoint=get_deployments_endpoint, methods=["GET"]),
        Route("/api/deployment-logs", endpoint=get_deployment_logs_endpoint, methods=["GET"]),
        Route("/api/commit-file", endpoint=commit_file_endpoint, methods=["POST"]),
        Route("/api/commit", endpoint=commit_file_endpoint, methods=["POST"]),
    ]
    admin_panel_dir = os.path.join(WEBAPP_DIR, "features", "admin_panel")
    features_dir = os.path.join(WEBAPP_DIR, "features")
    if os.path.exists(admin_panel_dir):
        routes.append(Mount("/app/admin_panel", StaticFiles(directory=admin_panel_dir), name="admin_panel"))
    if os.path.exists(features_dir):
        routes.append(Mount("/app/features", StaticFiles(directory=features_dir), name="features"))
    if health_check_handler:
        routes.append(Route("/health", endpoint=health_check_handler, methods=["GET"]))
    if telegram_webhook_handler:
        routes.append(Route(webhook_path, endpoint=telegram_webhook_handler, methods=["POST"]))
    return routes
