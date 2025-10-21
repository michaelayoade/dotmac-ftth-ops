#!/usr/bin/env python3
"""
Configure Alert Channels for DotMac Monitoring.

This script helps you set up alert notification channels (Slack, Discord, Teams, webhooks)
via the DotMac API. Channels can be configured to route alerts based on:
- Tenant ID
- Severity (info, warning, critical)
- Alert names
- Alert categories

Usage:
    python scripts/configure_alert_channels.py --help
    python scripts/configure_alert_channels.py --list
    python scripts/configure_alert_channels.py --create slack --name "Engineering Alerts" --webhook-url "https://hooks.slack.com/..."
    python scripts/configure_alert_channels.py --test <channel-id>
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

import httpx


class AlertChannelManager:
    """Manage alert channels via DotMac API."""

    def __init__(self, api_base_url: str, api_token: str | None = None):
        """Initialize the manager.

        Args:
            api_base_url: Base URL of DotMac API (e.g., http://localhost:8000)
            api_token: Optional JWT token for authentication
        """
        self.api_base_url = api_base_url.rstrip("/")
        self.api_token = api_token
        self.headers = {"Content-Type": "application/json"}
        if api_token:
            self.headers["Authorization"] = f"Bearer {api_token}"

    def list_channels(self) -> list[dict[str, Any]]:
        """List all configured alert channels."""
        url = f"{self.api_base_url}/api/v1/monitoring/alerts/channels"
        response = httpx.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def get_channel(self, channel_id: str) -> dict[str, Any]:
        """Get details of a specific channel."""
        url = f"{self.api_base_url}/api/v1/monitoring/alerts/channels/{channel_id}"
        response = httpx.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def create_channel(self, channel_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new alert channel."""
        url = f"{self.api_base_url}/api/v1/monitoring/alerts/channels"
        response = httpx.post(url, json=channel_data, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def update_channel(self, channel_id: str, channel_data: dict[str, Any]) -> dict[str, Any]:
        """Update an existing channel."""
        url = f"{self.api_base_url}/api/v1/monitoring/alerts/channels/{channel_id}"
        response = httpx.patch(url, json=channel_data, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def delete_channel(self, channel_id: str) -> None:
        """Delete a channel."""
        url = f"{self.api_base_url}/api/v1/monitoring/alerts/channels/{channel_id}"
        response = httpx.delete(url, headers=self.headers)
        response.raise_for_status()

    def test_channel(self, channel_id: str, severity: str = "warning", message: str | None = None) -> dict[str, bool]:
        """Send a test alert to a channel."""
        url = f"{self.api_base_url}/api/v1/monitoring/alerts/test"
        test_data = {
            "channel_id": channel_id,
            "severity": severity,
            "message": message or "Test alert from DotMac monitoring",
        }
        response = httpx.post(url, json=test_data, headers=self.headers)
        response.raise_for_status()
        return response.json()


def create_slack_channel(
    manager: AlertChannelManager,
    name: str,
    webhook_url: str,
    channel: str | None = None,
    tenant_id: str | None = None,
    severities: list[str] | None = None,
) -> dict[str, Any]:
    """Create a Slack alert channel."""
    channel_data = {
        "id": name.lower().replace(" ", "-"),
        "name": name,
        "channel_type": "slack",
        "webhook_url": webhook_url,
        "enabled": True,
        "slack_channel": channel,
        "tenant_id": tenant_id,
        "severities": severities,
    }
    return manager.create_channel(channel_data)


def create_discord_channel(
    manager: AlertChannelManager,
    name: str,
    webhook_url: str,
    tenant_id: str | None = None,
    severities: list[str] | None = None,
) -> dict[str, Any]:
    """Create a Discord alert channel."""
    channel_data = {
        "id": name.lower().replace(" ", "-"),
        "name": name,
        "channel_type": "discord",
        "webhook_url": webhook_url,
        "enabled": True,
        "tenant_id": tenant_id,
        "severities": severities,
    }
    return manager.create_channel(channel_data)


def create_teams_channel(
    manager: AlertChannelManager,
    name: str,
    webhook_url: str,
    tenant_id: str | None = None,
    severities: list[str] | None = None,
) -> dict[str, Any]:
    """Create a Microsoft Teams alert channel."""
    channel_data = {
        "id": name.lower().replace(" ", "-"),
        "name": name,
        "channel_type": "teams",
        "webhook_url": webhook_url,
        "enabled": True,
        "tenant_id": tenant_id,
        "severities": severities,
    }
    return manager.create_channel(channel_data)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Configure DotMac alert channels")
    parser.add_argument("--api-url", default="http://localhost:8000", help="DotMac API base URL")
    parser.add_argument("--token", help="JWT authentication token")

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # List channels
    subparsers.add_parser("list", help="List all configured channels")

    # Get channel
    get_parser = subparsers.add_parser("get", help="Get details of a specific channel")
    get_parser.add_argument("channel_id", help="Channel ID")

    # Create channel
    create_parser = subparsers.add_parser("create", help="Create a new alert channel")
    create_parser.add_argument("type", choices=["slack", "discord", "teams", "webhook"], help="Channel type")
    create_parser.add_argument("--name", required=True, help="Channel name")
    create_parser.add_argument("--webhook-url", required=True, help="Webhook URL")
    create_parser.add_argument("--slack-channel", help="Slack channel (e.g., #alerts)")
    create_parser.add_argument("--tenant-id", help="Filter alerts by tenant ID")
    create_parser.add_argument(
        "--severities",
        nargs="+",
        choices=["info", "warning", "critical"],
        help="Filter by severity levels",
    )

    # Delete channel
    delete_parser = subparsers.add_parser("delete", help="Delete a channel")
    delete_parser.add_argument("channel_id", help="Channel ID to delete")

    # Test channel
    test_parser = subparsers.add_parser("test", help="Send test alert to channel")
    test_parser.add_argument("channel_id", help="Channel ID to test")
    test_parser.add_argument("--severity", default="warning", choices=["info", "warning", "critical"])
    test_parser.add_argument("--message", help="Test message")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    manager = AlertChannelManager(args.api_url, args.token)

    try:
        if args.command == "list":
            channels = manager.list_channels()
            print(json.dumps(channels, indent=2))

        elif args.command == "get":
            channel = manager.get_channel(args.channel_id)
            print(json.dumps(channel, indent=2))

        elif args.command == "create":
            if args.type == "slack":
                result = create_slack_channel(
                    manager,
                    args.name,
                    args.webhook_url,
                    args.slack_channel,
                    args.tenant_id,
                    args.severities,
                )
            elif args.type == "discord":
                result = create_discord_channel(
                    manager,
                    args.name,
                    args.webhook_url,
                    args.tenant_id,
                    args.severities,
                )
            elif args.type == "teams":
                result = create_teams_channel(
                    manager,
                    args.name,
                    args.webhook_url,
                    args.tenant_id,
                    args.severities,
                )
            else:
                print(f"Channel type {args.type} not yet implemented")
                sys.exit(1)

            print("Channel created successfully:")
            print(json.dumps(result, indent=2))

        elif args.command == "delete":
            manager.delete_channel(args.channel_id)
            print(f"Channel {args.channel_id} deleted successfully")

        elif args.command == "test":
            result = manager.test_channel(args.channel_id, args.severity, args.message)
            print("Test alert sent:")
            print(json.dumps(result, indent=2))

    except httpx.HTTPStatusError as e:
        print(f"HTTP Error: {e.response.status_code}")
        print(e.response.text)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
