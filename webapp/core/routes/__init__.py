"""Central registry for the web application's modular API routes."""

from .routes_deployments import get_routes as get_deployment_routes
from .routes_github_form import get_routes as get_github_form_routes


def get_all_routes():
    """Collect API routes from each feature-specific route module."""
    return [
        *get_github_form_routes(),
        *get_deployment_routes(),
    ]


__all__ = ["get_all_routes"]
