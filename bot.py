import os
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes, Application

async def start(update, context):
    await update.message.reply_text('Hello! I am your bot.')

def main():
    TOKEN = os.getenv("BOT_TOKEN")
    if not TOKEN:
        raise ValueError("BOT_TOKEN environment variable not set")
    
    # Build the application
    application = ApplicationBuilder().token(TOKEN).build()
    
    # Add command handler
    application.add_handler(CommandHandler("start", start))
    
    # Run the bot with polling (no need for asyncio.run())
    application.run_polling()

if __name__ == '__main__':
    main()
