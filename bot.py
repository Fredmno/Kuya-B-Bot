import os
import uvicorn
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes
from starlette.applications import Starlette

from core import register_all_handlers
from webapp.core.routes import get_all_routes

BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID")
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH", "/webhook")
PORT = int(os.getenv("PORT", 8000))


async def on_startup(application):
    """Sends a Telegram notification to the admin once Render completes deployment."""
    if ADMIN_CHAT_ID:
        try:
            commit_hash = os.getenv("RENDER_GIT_COMMIT", "latest")[:7]
            service_name = os.getenv("RENDER_SERVICE_NAME", "Kuya B Hub")

            message = (
                f"🚀 *Deployment Successful!*\n\n"
                f"🤖 *Service:* {service_name}\n"
                f"📌 *Commit:* `{commit_hash}`\n"
                f"🟢 *Status:* Web server & bot live on Render\n"
                f"🔗 *Mini App:* ready at `/app`"
            )

            await application.bot.send_message(
                chat_id=int(ADMIN_CHAT_ID),
                text=message,
                parse_mode="Markdown"
            )
        except Exception as e:
            print(f"Failed to send deployment status notification: {e}")


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start command handler for Kuya B."""
    await update.message.reply_text("Hello! Kuya B is online.")


async def health_check(request):
    from starlette.responses import PlainTextResponse
    return PlainTextResponse("OK")


def main():
    application = (
        ApplicationBuilder()
        .token(BOT_TOKEN)
        .post_init(on_startup)
        .build()
    )

    # Pass the start_handler argument required by your core registration function
    register_all_handlers(application, start_command)

    routes = get_all_routes(
        health_check_handler=health_check,
        telegram_webhook_handler=None,
        webhook_path=WEBHOOK_PATH
    )

    app = Starlette(routes=routes)
    uvicorn.run(app, host="0.0.0.0", port=PORT)


if __name__ == "__main__":
    main()