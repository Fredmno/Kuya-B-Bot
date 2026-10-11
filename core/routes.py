import os
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles

# Feature route imports
from features.views.view_renderer import serve_index
from features.daily_logs.routes import get_daily_logs_routes
from features.BirthDay.Birthdays import (
    api_get_birthdays,
    api_add_birthday,
    api_edit_birthday,
    api_delete_birthday,
    api_send_birthday_greeting,
)
from features.tracking.tracking import (
    api_track_user,
    api_get_users,
)
from features.vault import (
    api_upload_vault_media,
    api_get_vault_media_file,
    api_get_vault_items,
    api_delete_vault_item,
)
from features.downloader import api_download_link_to_vault
from features.remote_sync import api_remote_sync_file
from features.admin.github_sync import (
    api_admin_commit_file,
    api_admin_get_repo_tree,
    api_admin_get_file_content,
)


def get_all_routes(health_check_handler, webhook_handler, cleanup_handler, webhook_path: str):
    """
    Assembles and returns all application HTTP routes.
    """
    routes = [
        # System & Webhook
        Route("/", health_check_handler, methods=["GET", "HEAD"]),
        Route(webhook_path, webhook_handler, methods=["POST"]),

        # WebApp Static & Entrypoint
        Route("/app", serve_index, methods=["GET"]),
        Route("/app/", serve_index, methods=["GET"]),
        Mount("/app", StaticFiles(directory="webapp", html=False), name="app"),

        # Birthdays
        Route("/api/birthdays", api_get_birthdays, methods=["GET"]),
        Route("/api/birthdays", api_add_birthday, methods=["POST"]),
        Route("/api/birthdays/edit", api_edit_birthday, methods=["POST"]),
        Route("/api/birthdays/delete", api_delete_birthday, methods=["POST"]),
        Route("/api/birthdays/greet", api_send_birthday_greeting, methods=["POST"]),

        # User Tracking
        Route("/api/track-user", api_track_user, methods=["POST"]),
        Route("/api/users", api_get_users, methods=["GET"]),

        # Vault & Downloader
        Route("/api/vault/items", api_get_vault_items, methods=["GET"]),
        Route("/api/vault/upload", api_upload_vault_media, methods=["POST"]),
        Route("/api/vault/download-url", api_download_link_to_vault, methods=["POST"]),
        Route("/api/vault/media-file", api_get_vault_media_file, methods=["GET"]),
        Route("/api/vault/delete", api_delete_vault_item, methods=["POST"]),

        # Admin & Remote Sync
        Route("/api/admin/remote-sync", api_remote_sync_file, methods=["POST"]),
        Route("/api/admin/repo-tree", api_admin_get_repo_tree, methods=["GET"]),
        Route("/api/admin/get-file", api_admin_get_file_content, methods=["GET"]),
        Route("/api/admin/commit-file", api_admin_commit_file, methods=["POST"]),
        Route("/api/cleanup-message", cleanup_handler, methods=["POST"]),

        # Feature Sub-routes (Daily Logs, etc.)
        *get_daily_logs_routes(),
    ]
    
    # Mount optional feature static directories if present
    if os.path.exists("features"):
        routes.append(Mount("/features", StaticFiles(directory="features", html=False), name="features"))

    return routes
