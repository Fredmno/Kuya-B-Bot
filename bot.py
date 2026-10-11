import os
import sys
import logging
import asyncio
import traceback
from contextlib import asynccontextmanager
import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

# Import the modular JSON committer handler
from bot_handlers.json_committer import handle_json_commit_message

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

try:
    from webapp.core.routes import get_all_routes
except Exception as e:
    logger.error(f"Failed to import routes: {e}")
    get_all_routes = None

BOT_TOKEN = os.environ.get("BOT_TOKEN")
PORT = int(os.environ.get("PORT", "10000"))
WEBHOOK_URL = os.environ.get("RENDER_EXTERNAL_URL") or os.environ.get("WEBHOOK_URL")

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    await update.message.reply_text(
        f"Kumusta {user.first_name}! Ako si Kuya B. 🤖\n\n"
        "Send your commit JSON payload directly here to push updates to GitHub."
    )

tg_app = None

async def health_handler(request: Request):
    return JSONResponse({"status": "healthy", "bot": "online", "app": "Kuya B"})

async def telegram_webhook_handler(request: Request):
    if tg_app is None:
        return JSONResponse({"error": "Bot not initialized"}, status_code=500)
    try:
        data = await request.json()
        update = Update.de_json(data, tg_app.bot)
        await tg_app.process_update(update)
        return JSONResponse({"ok": True})
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        return JSONResponse({"error": str(e)}, status_code=400)

@asynccontextmanager
async def lifespan(app: Starlette):
    global tg_app
    if BOT_TOKEN:
        try:
            logger.info("Initializing Telegram Bot Application...")
            tg_app = Application.builder().token(BOT_TOKEN).build()
            await tg_app.initialize()

            tg_app.add_handler(CommandHandler("start", start_command))
            # Attach the modular JSON committer handler
            tg_app.add_handler(
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_json_commit_message),
                group=0
            )

            await tg_app.start()

            if WEBHOOK_URL:
                clean_url = WEBHOOK_URL.rstrip("/")
                webhook_endpoint = f"{clean_url}/webhook"
                logger.info(f"Setting webhook to {webhook_endpoint}")
                try:
                    await tg_app.bot.set_webhook(url=webhook_endpoint)
                except Exception as e:
                    logger.warning(f"Failed to set webhook: {e}")
            else:
                logger.info("No WEBHOOK_URL specified; webhook not registered.")
        except Exception as e:
            logger.error(f"Failed to initialize Telegram Bot: {e}")
            logger.error(traceback.format_exc())
    else:
        logger.error("BOT_TOKEN is missing!")

    yield

    if tg_app:
        logger.info("Shutting down Telegram Bot...")
        try:
            await tg_app.stop()
            await tg_app.shutdown()
        except Exception as e:
            logger.warning(f"Error shutting down Telegram app: {e}")

def create_application() -> Starlette:
    routes = []
    if get_all_routes:
        try:
            routes = get_all_routes(
                health_check_handler=health_handler,
                telegram_webhook_handler=telegram_webhook_handler,
                webhook_path="/webhook"
            )
        except Exception as e:
            logger.error(f"Failed calling get_all_routes: {e}")
            logger.error(traceback.format_exc())

    if not routes:
        from starlette.routing import Route
        routes = [
            Route("/health", endpoint=health_handler, methods=["GET"]),
            Route("/webhook", endpoint=telegram_webhook_handler, methods=["POST"]),
        ]

    return Starlette(routes=routes, lifespan=lifespan)

app = create_application()

if __name__ == "__main__":
    logger.info(f"Starting Kuya B server on port {PORT}...")
    config = uvicorn.Config(
        app=app,
        host="0.0.0.0",
        port=PORT,
        log_level="info",
        access_log=True,
    )
    server = uvicorn.Server(config)
    try:
        asyncio.run(server.serve())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Server stopped.")
    except Exception as e:
        logger.error(f"Server crashed: {e}")
        traceback.print_exc()
        sys.exit(1)
