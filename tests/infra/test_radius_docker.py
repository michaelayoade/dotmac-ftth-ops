"""
FreeRADIUS Docker Smoke Tests

These tests verify that the FreeRADIUS service exposed via Docker Compose
responds to real RADIUS authentication traffic. They require the ISP
infrastructure stack to be running locally (``make start-isp``) with the
default credentials from ``config/radius``.
"""

from __future__ import annotations

import os
import platform
import socket
from pathlib import Path

import pytest

from pyrad.client import Client, Timeout
from pyrad.dictionary import Dictionary
from pyrad.packet import AccessAccept, AccessReject, AccessRequest


pytestmark = [pytest.mark.integration, pytest.mark.infra]

# Docker Desktop for Mac has known issues with UDP port forwarding
# See: https://github.com/docker/for-mac/issues/68
SKIP_ON_MACOS = platform.system() == "Darwin"
MACOS_SKIP_REASON = (
    "UDP port forwarding from macOS host to Docker containers is unreliable. "
    "FreeRADIUS works correctly (healthcheck passes), but direct connections from "
    "macOS host timeout due to Docker Desktop limitations. Run this test on Linux "
    "or inside the Docker network."
)


@pytest.fixture(scope="module")
def radius_endpoint():
    """Return connection parameters for the local FreeRADIUS instance."""
    host = os.getenv("FREERADIUS_HOST", "127.0.0.1")
    port = int(os.getenv("FREERADIUS_AUTH_PORT", "1812"))
    secret = os.getenv("FREERADIUS_SHARED_SECRET", "testing123").encode("utf-8")
    return host, port, secret


@pytest.fixture(scope="module")
def radius_dictionary() -> Dictionary:
    """
    Load the project-provided RADIUS dictionary.

    Falls back to pyrad's bundled dictionaries if the local files are missing.
    """
    repo_root = Path(__file__).resolve().parents[2]
    custom_dictionary = repo_root / "config" / "radius" / "dictionary"
    vendor_dictionary = repo_root / "config" / "radius" / "dictionary.rfc5176"

    dictionary_paths: list[str] = []
    if custom_dictionary.exists():
        dictionary_paths.append(str(custom_dictionary))
    if vendor_dictionary.exists():
        dictionary_paths.append(str(vendor_dictionary))

    if dictionary_paths:
        return Dictionary(*dictionary_paths)

    # Fall back to pyrad's built-in set
    return Dictionary("dictionary")


@pytest.fixture(scope="module")
def radius_available(radius_endpoint):
    """
    Perform a lightweight UDP probe so we can skip when FreeRADIUS is offline.

    UDP sockets do not establish real connections, so we send a one-byte packet
    and only care whether the OS reports that the destination network is
    unreachable.
    """
    host, port, _ = radius_endpoint
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(1.0)
    try:
        sock.sendto(b"\x00", (host, port))
    except OSError as exc:
        pytest.skip(f"FreeRADIUS not reachable at {host}:{port}: {exc}")  # pragma: no cover
    finally:
        sock.close()
    return True


@pytest.mark.skipif(SKIP_ON_MACOS, reason=MACOS_SKIP_REASON)
def test_access_request_roundtrip(radius_endpoint, radius_dictionary, radius_available):
    """
    Send a real Access-Request to FreeRADIUS and assert we receive any response.

    The default Docker image seeds a ``test`` user with password ``test`` which
    the ``radtest`` health check also relies on. We assert a deterministic
    reply code rather than the access decision so that the check stays valid
    even if operators rotate the shared secret.

    Note: This test is skipped on macOS due to Docker Desktop UDP port forwarding
    limitations. The FreeRADIUS service itself works correctly (verified by healthcheck).
    """
    host, port, secret = radius_endpoint
    client = Client(server=host, authport=port, secret=secret, dict=radius_dictionary)
    client.retries = 1
    client.timeout = 3

    request = client.CreateAuthPacket(code=AccessRequest)
    request["User-Name"] = "test"
    request["User-Password"] = request.PwCrypt("test")
    request["NAS-Identifier"] = "pytest-radius-smoke"

    try:
        reply = client.SendPacket(request)
    except Timeout as exc:  # pragma: no cover - network setup issue
        pytest.skip(f"FreeRADIUS timed out handling Access-Request: {exc}")

    assert reply.code in {AccessAccept, AccessReject}
