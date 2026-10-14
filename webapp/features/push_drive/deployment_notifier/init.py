"""
Deployment Notifier Feature Package
webapp.features.push_drive.deployment_notifier
"""
from .notifier import poll_render_deploy
__all__ = ["poll_render_deploy"]