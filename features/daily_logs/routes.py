from starlette.routing import Route
from telegram.ext import CommandHandler, Application

from features.daily_logs.daily_logs import (
    api_get_daily_logs,
    api_save_daily_log,
    api_delete_daily_log,
)
from features.daily_logs.user_access.access_control import (
    api_request_daily_logs_access,
    api_approve_daily_logs_access,
    command_approve_logs,
)


def get_daily_logs_routes() -> list[Route]:
    """Returns all Starlette HTTP routes for Daily Logs."""
    return [
        Route("/api/logs", api_get_daily_logs, methods=["GET"]),
        Route("/api/logs", api_save_daily_log, methods=["POST"]),
        Route("/api/logs/delete", api_delete_daily_log, methods=["POST"]),
        Route("/api/logs/request-access", api_request_daily_logs_access, methods=["POST"]),
        Route("/api/logs/approve-access", api_approve_daily_logs_access, methods=["POST"]),
    ]


def register_daily_logs_handlers(application: Application):
    """Registers all Telegram bot handlers for Daily Logs."""
    application.add_handler(CommandHandler("approve_logs", command_approve_logs))
