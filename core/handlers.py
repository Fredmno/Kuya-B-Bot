from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
)

from features.menu import kuya_b_menu, menu_callback_handler
from features.business.assistant import handle_business_message
from features.word_game import register_word_game_handlers
#from features.daily_logs.routes import #register_daily_logs_handlers
from features.BirthDay.Birthdays import (
    command_add_birthday,
    command_trigger_bulletin,
)


def register_all_handlers(application: Application, start_handler):
    """
    Registers all Telegram command and message handlers across features.
    """
    # Core bot commands
    application.add_handler(CommandHandler("start", start_handler))
    application.add_handler(CommandHandler("kuyab", kuya_b_menu))
    application.add_handler(CommandHandler("kuya_b", kuya_b_menu))

    # Birthday commands
    application.add_handler(CommandHandler("bday", command_add_birthday))
    application.add_handler(CommandHandler("trigger_greetings", command_trigger_bulletin))

    # Menus and Business
    application.add_handler(CallbackQueryHandler(menu_callback_handler))
    application.add_handler(MessageHandler(filters.UpdateType.BUSINESS_MESSAGE, handle_business_message))

    # Sub-feature modular handlers
    register_word_game_handlers(application)
    #register_daily_logs_handlers(application)
