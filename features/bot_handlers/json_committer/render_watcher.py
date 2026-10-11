import os
import asyncio
import logging
import httpx

logger = logging.getLogger(__name__)

RENDER_API_KEY = os.environ.get("RENDER_API_KEY")
RENDER_SERVICE_ID = os.environ.get("RENDER_SERVICE_ID", "srv-d8vn7n6rnols73dtbf00")

async def poll_render_deploy(status_msg, commit_sha: str, rel_path: str, commit_msg: str):
    """
    Polls Render's API for the status of the deployment triggered by commit_sha
    and edits the Telegram message accordingly.
    """
    if not (RENDER_API_KEY and RENDER_SERVICE_ID):
        await status_msg.edit_text(
            f"🚀 *Commit Pushed to GitHub!*\n\n"
            f"📄 *File:* `{rel_path}`\n"
            f"💬 *Message:* {commit_msg}\n"
            f"🔗 *Commit SHA:* `{commit_sha}`\n\n"
            "ℹ️ _Render credentials not set; build running via automatic deploy._",
            parse_mode="Markdown"
        )
        return

    render_headers = {
        "Authorization": f"Bearer {RENDER_API_KEY}",
        "Accept": "application/json"
    }
    url = f"https://api.render.com/v1/services/{RENDER_SERVICE_ID}/deploys?limit=5"

    for _ in range(25):  # Poll every 12s for ~5 minutes
        await asyncio.sleep(12)
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(url, headers=render_headers, timeout=10.0)
                if r.status_code == 200:
                    deploys = r.json()
                    for item in deploys:
                        deploy_obj = item.get("deploy", {})
                        c_id = deploy_obj.get("commit", {}).get("id", "")
                        if c_id.startswith(commit_sha) or commit_sha.startswith(c_id[:7]):
                            status = deploy_obj.get("status", "").lower()
                            if status == "live":
                                await status_msg.edit_text(
                                    f"✅ *Render Deployment Live!*\n\n"
                                    f"📄 *File:* `{rel_path}`\n"
                                    f"💬 *Message:* {commit_msg}\n"
                                    f"🔗 *Commit SHA:* `{commit_sha}`\n\n"
                                    f"🟢 Status: *Success (Live)*",
                                    parse_mode="Markdown"
                                )
                                return
                            elif status in ("build_failed", "update_failed", "canceled"):
                                await status_msg.edit_text(
                                    f"❌ *Render Deployment Failed*\n\n"
                                    f"📄 *File:* `{rel_path}`\n"
                                    f"🔗 *Commit SHA:* `{commit_sha}`\n\n"
                                    f"⚠️ Status: *{status.replace('_', ' ').title()}*",
                                    parse_mode="Markdown"
                                )
                                return
        except Exception as e:
            logger.warning(f"Error polling Render API: {e}")
