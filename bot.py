from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

# Define a command handler (optional)
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text('Hello! I am your bot.')

async def main():
    # Ensure your BOT_TOKEN is set as an environment variable
    import os
    TOKEN = os.getenv("BOT_TOKEN")
    if not TOKEN:
        raise ValueError("BOT_TOKEN environment variable not set")
    
    # Create the application
    app = ApplicationBuilder().token(TOKEN).build()

    # Register command handlers
    app.add_handler(CommandHandler("start", start))
    # Add other handlers here

    # Run the bot until you manually stop it
    await app.run_polling()

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
