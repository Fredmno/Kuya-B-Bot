import os
import httpx
from starlette.requests import Request
from starlette.responses import JSONResponse

BOT_TOKEN = os.environ.get("BOT_TOKEN")
ADMIN_CHAT_ID = "7698531657"

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "alfredodimaano/Kuya-B-Bot-1")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")

def get_clean_repo():
    repo = os.environ.get("GITHUB_REPO", "alfredodimaano/Kuya-B-Bot-1")
    if "github.com/" in repo:
        repo = repo.split("github.com/")[-1].replace(".git", "").strip("/")
    return repo

async def get_deployments_endpoint(request: Request):
    """Fetches deployments with modified file lists, patch diffs, and full commit messages."""
    token = os.environ.get("GITHUB_TOKEN")
    repo = get_clean_repo()
    branch = os.environ.get("GITHUB_BRANCH", "main")

    headers = {"Accept": "application/vnd.github.v3+json"}
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

                    # Fetch specific commit details to obtain files changed and diff patch logs
                    files_changed = []
                    detail_url = f"https://api.github.com/repos/{repo}/commits/{sha}"
                    try:
                        detail_res = await client.get(detail_url, headers=headers, timeout=8.0)
                        if detail_res.status_code == 200:
                            detail_json = detail_res.json()
                            for f in detail_json.get("files", []):
                                files_changed.append({
                                    "filename": f.get("filename", ""),
                                    "status": f.get("status", "modified"),
                                    "additions": f.get("additions", 0),
                                    "deletions": f.get("deletions", 0),
                                    "patch": f.get("patch", "Binary or large diff — content not previewable inline")
                                })
                    except Exception as err:
                        print(f"Error fetching detail for commit {short_sha}: {err}")

                    deployments.append({
                        "id": f"commit-{short_sha}",
                        "name": f"Deploy #{len(raw_commits) - idx}: {first_line[:40]}",
                        "date": date_str,
                        "status": "Live" if idx == 0 else "Success",
                        "commit": short_sha,
                        "full_sha": sha,
                        "author": author_info.get("name", "GitHub"),
                        "message": raw_msg,
                        "files": files_changed
                    })

                return JSONResponse({"deployments": deployments, "ok": True})
            return JSONResponse({"deployments": [], "error": res.text, "ok": False}, status_code=res.status_code)
    except Exception as e:
        return JSONResponse({"deployments": [], "error": str(e), "ok": False}, status_code=500)

async def github_webhook_handler(request: Request):
    return JSONResponse({"status": "received", "ok": True})

async def render_webhook_handler(request: Request):
    return JSONResponse({"status": "received", "ok": True})
