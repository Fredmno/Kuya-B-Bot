import os
import uuid
import logging
import httpx
from starlette.requests import Request
from starlette.responses import JSONResponse, StreamingResponse

from features.registry import get_or_create_registry, update_registry_data

logger = logging.getLogger(__name__)
VAULT_CHAT_ID = os.getenv("VAULT_CHAT_ID")


def _get_chat_id():
    cid = os.getenv("VAULT_CHAT_ID")
    if not cid:
        return None
    try:
        return int(cid.strip())
    except ValueError:
        return None


async def api_get_vault_items(request: Request):
    try:
        bot = request.app.state.telegram_app.bot
        _, registry = await get_or_create_registry(bot)
        vault_items = registry.get("vault", [])
        return JSONResponse({"vault": vault_items})
    except Exception as e:
        logger.error(f"api_get_vault_items error: {e}", exc_info=True)
        return JSONResponse({"error": str(e), "vault": []}, status_code=500)


async def api_upload_vault_media(request: Request):
    try:
        form = await request.form()
        file_obj = form.get("file")
        title = form.get("title", "Untitled")
        folder = form.get("folder", "General")
        media_type = form.get("type", "pictures")

        if not file_obj:
            return JSONResponse({"error": "No file uploaded"}, status_code=400)

        chat_id = _get_chat_id()
        if not chat_id:
            return JSONResponse({"error": "VAULT_CHAT_ID is not configured in backend."}, status_code=500)

        bot = request.app.state.telegram_app.bot
        file_bytes = await file_obj.read()
        file_name = getattr(file_obj, "filename", "media_file")

        # 1. Send file to Telegram vault channel/chat
        caption = f"📁 #{folder}\n📌 {title}"
        if media_type == "videos" or file_name.lower().endswith((".mp4", ".mov", ".m4v", ".webm")):
            msg = await bot.send_video(chat_id=chat_id, video=file_bytes, caption=caption, read_timeout=120, write_timeout=120)
            file_id = msg.video.file_id
        elif media_type == "pictures" or file_name.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            msg = await bot.send_photo(chat_id=chat_id, photo=file_bytes, caption=caption, read_timeout=60, write_timeout=60)
            file_id = msg.photo[-1].file_id
        else:
            msg = await bot.send_document(chat_id=chat_id, document=file_bytes, filename=file_name, caption=caption, read_timeout=120, write_timeout=120)
            file_id = msg.document.file_id

        # 2. Record item in the permanent registry
        msg_id, registry = await get_or_create_registry(bot)
        vault_items = registry.setdefault("vault", [])

        new_item = {
            "id": str(uuid.uuid4())[:8],
            "title": str(title),
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
        logger.error(f"api_upload_vault_media error: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_get_vault_media_file(request: Request):
    item_id = request.query_params.get("id")
    if not item_id:
        return JSONResponse({"error": "Missing item id"}, status_code=400)

    bot = request.app.state.telegram_app.bot
    _, registry = await get_or_create_registry(bot)
    vault_items = registry.get("vault", [])

    target_item = next((it for it in vault_items if str(it.get("id")) == str(item_id)), None)
    if not target_item:
        return JSONResponse({"error": "Item not found"}, status_code=404)

    file_id = target_item.get("file_id")

    # If the item only has messageId (from earlier manual entries), resolve file_id
    if not file_id and target_item.get("messageId"):
        try:
            chat_id = _get_chat_id()
            msg = await bot.forward_message(
                chat_id=chat_id,
                from_chat_id=chat_id,
                message_id=int(target_item["messageId"])
            )
            if msg.video:
                file_id = msg.video.file_id
            elif msg.photo:
                file_id = msg.photo[-1].file_id
            elif msg.document:
                file_id = msg.document.file_id
        except Exception as resolve_err:
            logger.warning(f"Could not forward message to resolve file_id: {resolve_err}")

    if not file_id:
        return JSONResponse({"error": "Unable to resolve media file."}, status_code=404)

    try:
        tg_file = await bot.get_file(file_id)
        file_url = tg_file.file_path

        client = httpx.AsyncClient(timeout=120.0)
        req = client.build_request("GET", file_url)
        res = await client.send(req, stream=True)

        content_type = "video/mp4" if target_item.get("type") == "videos" else "image/jpeg"

        return StreamingResponse(
            res.aiter_raw(),
            status_code=res.status_code,
            media_type=content_type,
            headers={
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=3600",
                "Content-Disposition": f"inline; filename=\"media_{item_id}.mp4\""
            }
        )
    except Exception as e:
        logger.error(f"api_get_vault_media_file error: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_delete_vault_item(request: Request):
    try:
        data = await request.json()
        item_id = data.get("id")

        if not item_id:
            return JSONResponse({"error": "Item ID is required"}, status_code=400)

        bot = request.app.state.telegram_app.bot
        msg_id, registry = await get_or_create_registry(bot)
        vault_items = registry.get("vault", [])

        filtered = [it for it in vault_items if str(it.get("id")) != str(item_id)]
        registry["vault"] = filtered

        await update_registry_data(msg_id, registry, bot)
        return JSONResponse({"success": True})
    except Exception as e:
        logger.error(f"api_delete_vault_item error: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)
