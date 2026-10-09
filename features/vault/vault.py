import logging
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse, Response
from starlette.datastructures import UploadFile

from config import get_vault_chat_id
from database import (
    db_get_all_vault_items,
    db_add_vault_item,
    db_get_vault_item_by_id,
    db_delete_vault_item,
)


async def api_upload_vault_media(request: Request):
    """Receives file upload from Mini App, uploads to Telegram Channel, and records in PostgreSQL."""
    try:
        app = request.app.state.telegram_app
        form = await request.form()
        file: UploadFile = form.get("file")
        title = form.get("title", "Untitled").strip() or "Untitled"
        folder = form.get("folder", "General").strip() or "General"
        media_type = form.get("type", "pictures").strip()

        if not file:
            return JSONResponse({"error": "No file uploaded"}, status_code=400)

        channel_id = get_vault_chat_id()
        if not channel_id:
            return JSONResponse({"error": "VAULT_CHANNEL_ID not configured"}, status_code=500)

        file_bytes = await file.read()
        caption = f"📁 **VAULT MEDIA**\n🏷️ **Title:** {title}\n📂 **Folder:** #{folder}"

        # 1. Forward to Telegram channel for unlimited storage
        saved_file_id = None
        if media_type == "pictures":
            sent = await app.bot.send_photo(
                chat_id=channel_id,
                photo=file_bytes,
                caption=caption,
                parse_mode="Markdown"
            )
            saved_file_id = sent.photo[-1].file_id
        else:
            sent = await app.bot.send_video(
                chat_id=channel_id,
                video=file_bytes,
                caption=caption,
                parse_mode="Markdown"
            )
            saved_file_id = sent.video.file_id

        # 2. Persist metadata into PostgreSQL
        item_id = str(sent.message_id)
        db_add_vault_item(
            item_id=item_id,
            media_type=media_type,
            title=title,
            folder=folder,
            message_id=item_id,
            file_id=saved_file_id
        )

        entry = {
            "id": item_id,
            "type": media_type,
            "title": title,
            "folder": folder,
            "messageId": item_id,
            "fileId": saved_file_id
        }

        return JSONResponse({"success": True, "item": entry})
    except Exception as e:
        logging.error(f"Error handling media upload to vault: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_get_vault_items(request: Request):
    """Retrieves vault items from PostgreSQL."""
    items = db_get_all_vault_items()
    return JSONResponse({"success": True, "vault": items})


async def api_get_vault_media_file(request: Request):
    """Streams media bytes directly to Mini App lightbox with proper MIME type."""
    item_id = request.query_params.get("id")
    if not item_id:
        return PlainTextResponse("Missing item id", status_code=400)

    channel_id = get_vault_chat_id()
    if not channel_id:
        return PlainTextResponse("Channel ID not configured", status_code=500)

    try:
        app = request.app.state.telegram_app
        matched = db_get_vault_item_by_id(item_id)

        file_id = None
        is_video = False

        if matched and matched.get("fileId"):
            file_id = matched["fileId"]
            is_video = (matched.get("type") == "videos")
        else:
            # Fallback: Forward briefly to detect file_id if missing
            msg = await app.bot.forward_message(
                chat_id=channel_id,
                from_chat_id=channel_id,
                message_id=int(item_id)
            )
            await app.bot.delete_message(chat_id=channel_id, message_id=msg.message_id)

            if msg.photo:
                file_id = msg.photo[-1].file_id
                is_video = False
            elif msg.video:
                file_id = msg.video.file_id
                is_video = True

        if not file_id:
            return PlainTextResponse("Media file not found", status_code=404)

        tg_file = await app.bot.get_file(file_id)
        file_bytes = await tg_file.download_as_bytearray()

        content_type = "video/mp4" if is_video else "image/jpeg"
        return Response(content=bytes(file_bytes), media_type=content_type)
    except Exception as e:
        logging.error(f"Error streaming vault media: {e}", exc_info=True)
        return PlainTextResponse(f"Error: {e}", status_code=500)


async def api_delete_vault_item(request: Request):
    """Deletes item from PostgreSQL and removes the Telegram channel message."""
    try:
        app = request.app.state.telegram_app
        data = await request.json()
        item_id = str(data.get("id"))
        channel_id = get_vault_chat_id()

        try:
            await app.bot.delete_message(chat_id=channel_id, message_id=int(item_id))
        except Exception as e:
            logging.warning(f"Could not delete channel message {item_id}: {e}")

        db_delete_vault_item(item_id)
        return JSONResponse({"success": True})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
