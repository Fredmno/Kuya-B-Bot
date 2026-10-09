import os
import uuid
import tempfile
import logging
import httpx
import yt_dlp
from starlette.requests import Request
from starlette.responses import JSONResponse

from features.registry import get_or_create_registry, update_registry_data

logger = logging.getLogger(__name__)


def _get_chat_id():
    cid = os.getenv("VAULT_CHAT_ID")
    return int(cid.strip()) if cid else None


async def download_media_from_url(url: str):
    """
    Downloads media using httpx (for direct images/videos) 
    or yt-dlp (for video platforms).
    Returns (media_type, bytes, title)
    """
    clean_url = url.split("?")[0].lower()
    
    # 1. Direct Image Links
    if clean_url.endswith((".jpg", ".jpeg", ".png", ".webp", ".gif")):
        async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return "pictures", resp.content, "Downloaded Image"

    # 2. Video Platforms & Direct Videos via yt-dlp
    temp_dir = tempfile.mkdtemp()
    out_tmpl = os.path.join(temp_dir, "%(title).60s.%(ext)s")

    ydl_opts = {
        "outtmpl": out_tmpl,
        "format": "best[ext=mp4]/best",
        "max_filesize": 50 * 1024 * 1024,  # Telegram bot 50MB upload limit
        "quiet": True,
        "no_warnings": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get("title", "Downloaded Video")
            
            # Locate downloaded file in temp directory
            downloaded = [f for f in os.listdir(temp_dir) if not f.endswith(".part")]
            if not downloaded:
                raise Exception("Media stream could not be extracted.")
            
            filepath = os.path.join(temp_dir, downloaded[0])
            with open(filepath, "rb") as f:
                content = f.read()

            ext = os.path.splitext(downloaded[0])[1].lower()
            m_type = "pictures" if ext in [".jpg", ".jpeg", ".png", ".webp"] else "videos"
            return m_type, content, title
    finally:
        for f in os.listdir(temp_dir):
            try:
                os.remove(os.path.join(temp_dir, f))
            except Exception:
                pass
        try:
            os.rmdir(temp_dir)
        except Exception:
            pass


async def api_download_link_to_vault(request: Request):
    try:
        data = await request.json()
        url = data.get("url", "").strip()
        folder = data.get("folder", "").strip() or "Downloads"
        custom_title = data.get("title", "").strip()

        if not url:
            return JSONResponse({"error": "Please provide a valid URL."}, status_code=400)

        chat_id = _get_chat_id()
        if not chat_id:
            return JSONResponse({"error": "VAULT_CHAT_ID is not configured in environment."}, status_code=500)

        bot = request.app.state.telegram_app.bot

        # Download remote media
        media_type, media_bytes, detected_title = await download_media_from_url(url)
        final_title = custom_title if custom_title else detected_title

        caption = f"📁 #{folder}\n📌 {final_title}\n🔗 {url[:50]}"

        if media_type == "videos":
            msg = await bot.send_video(
                chat_id=chat_id,
                video=media_bytes,
                caption=caption,
                read_timeout=120,
                write_timeout=120
            )
            file_id = msg.video.file_id
        else:
            msg = await bot.send_photo(
                chat_id=chat_id,
                photo=media_bytes,
                caption=caption,
                read_timeout=60,
                write_timeout=60
            )
            file_id = msg.photo[-1].file_id

        # Update persistent registry
        msg_id, registry = await get_or_create_registry(bot)
        vault_items = registry.setdefault("vault", [])
        new_item = {
            "id": str(uuid.uuid4())[:8],
            "title": str(final_title),
            "folder": str(folder),
            "type": str(media_type),
            "file_id": file_id,
            "messageId": str(msg.message_id),
            "chat_id": str(chat_id)
        }
        vault_items.append(new_item)
        await update_registry_data(msg_id, registry, bot)

        return JSONResponse({"success": True, "item": new_item})

    except Exception as e:
        logger.error(f"api_download_link_to_vault error: {e}", exc_info=True)
        return JSONResponse({"error": f"Failed to download media: {str(e)}"}, status_code=500)
