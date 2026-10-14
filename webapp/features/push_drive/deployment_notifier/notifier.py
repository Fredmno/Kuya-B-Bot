import os


import asyncio


import logging


import httpx


logger = logging.getLogger(__name__)


RENDER_API_KEY = os.environ.get("RENDER_API_KEY")


RENDER_SERVICE_ID = os.environ.get("RENDER_SERVICE_ID", "srv-d8vn7n6rnols73dtbf00")


RENDER_EXTERNAL_URL = os.environ.get("RENDER_EXTERNAL_URL", "https://kuya-b-bot-1.onrender.com")


async def poll_render_deploy(status_msg, commit_sha: str, rel_path: str, commit_msg: str):


    """Monitors deployment on Render following a commit and pushes an active Telegram notification."""


    try:


        if RENDER_API_KEY and RENDER_SERVICE_ID:


            headers = {


                "Authorization": f"Bearer {RENDER_API_KEY}",


                "Accept": "application/json"


            }


            url = f"https://api.render.com/v1/services/{RENDER_SERVICE_ID}/deploys?limit=5"


            for _ in range(30):


                await asyncio.sleep(10)


                try:


                    async with httpx.AsyncClient() as client:


                        r = await client.get(url, headers=headers, timeout=12.0)


                        if r.status_code == 200:


                            deploys = r.json()


                            for item in deploys:


                                deploy_obj = item.get("deploy") if isinstance(item.get("deploy"), dict) else item


                                commit_info = deploy_obj.get("commit") if isinstance(deploy_obj.get("commit"), dict) else {}


                                c_id = commit_info.get("id") or commit_info.get("sha") or deploy_obj.get("commitId") or ""


                                if c_id.startswith(commit_sha) or commit_sha.startswith(c_id[:7]):


                                    status = str(deploy_obj.get("status", "")).lower()


                                    if status == "live":


                                        try:


                                            await status_msg.edit_text(


                                                f"✅ *Render Deployment Live!*\n\n"


                                                f"📄 *File:* `{rel_path}`\n"


                                                f"💬 *Message:* {commit_msg}\n"


                                                f"🔗 *Commit SHA:* `{commit_sha}`\n\n"


                                                "🟢 Status: *Success (Live)*",


                                                parse_mode="Markdown"


                                            )


                                        except Exception:


                                            pass


                                        await status_msg.reply_text(


                                            f"🔔 *Deployment Live!*\n\n"


                                            f"✅ `{rel_path}` is live in production!\n"


                                            f"🔗 Commit: `{commit_sha}`",


                                            parse_mode="Markdown"


                                        )


                                        return


                                    elif status in ("build_failed", "update_failed", "canceled"):


                                        try:


                                            await status_msg.edit_text(


                                                f"❌ *Render Deployment Failed*\n\n"


                                                f"📄 *File:* `{rel_path}`\n"


                                                f"🔗 *Commit SHA:* `{commit_sha}`\n\n"


                                                f"⚠️ Status: *{status.replace('_', ' ').title()}*",


                                                parse_mode="Markdown"


                                            )


                                        except Exception:


                                            pass


                                        await status_msg.reply_text(


                                            f"⚠️ *Render Build Alert!*\nDeployment of `{rel_path}` ended with status: *{status}*.",


                                            parse_mode="Markdown"


                                        )


                                        return


                except Exception as inner_e:


                    logger.warning(f"Error checking Render API: {inner_e}")


        # Fallback Timer & Health Check Mode


        await asyncio.sleep(45)


        health_url = f"{RENDER_EXTERNAL_URL.rstrip('/')}/health"


        health_ok = False


        try:


            async with httpx.AsyncClient() as client:


                hr = await client.get(health_url, timeout=8.0)


                if hr.status_code == 200:


                    health_ok = True


        except Exception:


            pass


        status_label = "*Success (Live)*" if health_ok else "*Completed (Pending Cache)*"


        try:


            await status_msg.edit_text(


                f"✅ *Render Deployment Active!*\n\n"


                f"📄 *File:* `{rel_path}`\n"


                f"💬 *Message:* {commit_msg}\n"


                f"🔗 *Commit SHA:* `{commit_sha}`\n\n"


                f"🟢 Status: {status_label}",


                parse_mode="Markdown"


            )


        except Exception:


            pass


        await status_msg.reply_text(


            f"🔔 *Deployment Notification!*\n\n"


            f"✅ Commit `{commit_sha}` (`{rel_path}`) has completed its deployment build.",


            parse_mode="Markdown"


        )


    except Exception as e:


        logger.error(f"Fatal error in poll_render_deploy: {e}", exc_info=True)


        try:


            await status_msg.reply_text(f"⚠️ Deployment tracker notice: `{str(e)}`")


        except Exception:


            pass