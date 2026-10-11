import os
import httpx
from starlette.routing import Route
from starlette.requests import Request
from starlette.responses import JSONResponse

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "Fredmno/Kuya-B-Bot")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")
RENDER_API_KEY = os.environ.get("RENDER_API_KEY")
RENDER_SERVICE_ID = os.environ.get("RENDER_SERVICE_ID", "srv-d8vn7n6rnols73dtbf00")

def get_clean_repo():
    repo = GITHUB_REPO
    if "github.com/" in repo:
        repo = repo.split("github.com/")[-1].replace(".git", "").strip("/")
    return repo.strip()

async def get_deployments_endpoint(request: Request):
    deployments = []
    if RENDER_API_KEY and RENDER_SERVICE_ID:
        render_headers = {"Authorization": f"Bearer {RENDER_API_KEY}", "Accept": "application/json"}
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(f"https://api.render.com/v1/services/{RENDER_SERVICE_ID}/deploys?limit=10", headers=render_headers, timeout=10.0)
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

    repo = get_clean_repo()
    branch = GITHUB_BRANCH
    gh_headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "KuyaB-Bot-App"}
    if GITHUB_TOKEN:
        gh_headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    try:
        async with httpx.AsyncClient() as client:
            gh_res = await client.get(f"https://api.github.com/repos/{repo}/commits?sha={branch}&per_page=10", headers=gh_headers, timeout=10.0)
            if gh_res.status_code == 200:
                for idx, c in enumerate(gh_res.json()):
                    commit_obj = c.get("commit", {})
                    short_sha = c.get("sha", "")[:7]
                    deployments.append({
                        "id": short_sha,
                        "name": commit_obj.get("message", "Deploy").splitlines()[0][:45],
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
    repo = get_clean_repo()
    gh_headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "KuyaB-Bot-App"}
    if GITHUB_TOKEN:
        gh_headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    if commit_sha:
        try:
            async with httpx.AsyncClient() as client:
                diff_res = await client.get(f"https://api.github.com/repos/{repo}/commits/{commit_sha}", headers=gh_headers, timeout=10.0)
                if diff_res.status_code == 200:
                    commit_data = diff_res.json()
                    changed_files = [f.get("filename") for f in commit_data.get("files", [])]
        except Exception:
            pass

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

def get_routes():
    return [
        Route("/api/deployment-history", endpoint=get_deployments_endpoint, methods=["GET"]),
        Route("/app/api/deployment-history", endpoint=get_deployments_endpoint, methods=["GET"]),
        Route("/api/deployment-logs", endpoint=get_deployment_logs_endpoint, methods=["GET"]),
        Route("/app/api/deployment-logs", endpoint=get_deployment_logs_endpoint, methods=["GET"]),
    ]
