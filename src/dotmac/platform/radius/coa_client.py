"""
RADIUS CoA/DM Client Implementation

Implements RFC 5176 Change of Authorization (CoA) and Disconnect Messages (DM)
for dynamic session control.

This module provides functionality to send CoA/DM packets to RADIUS servers
to disconnect sessions, update bandwidth limits, or change service policies.
"""

import asyncio
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)


class CoAClient:
    """
    RADIUS CoA/DM Client using radclient command-line tool.

    This implementation uses FreeRADIUS's radclient tool to send
    CoA and Disconnect-Request packets. This is more reliable than
    pure Python implementations and works with all RADIUS servers.

    For production, consider using:
    - pyrad library (pure Python)
    - Direct integration with FreeRADIUS REST API
    - CoA server daemon for queuing
    """

    def __init__(
        self,
        radius_server: str = "localhost",
        coa_port: int = 3799,
        radius_secret: str = "testing123",
        timeout: int = 5,
    ):
        """
        Initialize CoA client.

        Args:
            radius_server: RADIUS server IP or hostname
            coa_port: CoA port (RFC 5176 default: 3799)
            radius_secret: Shared secret for RADIUS server
            timeout: Request timeout in seconds
        """
        self.radius_server = radius_server
        self.coa_port = coa_port
        self.radius_secret = radius_secret
        self.timeout = timeout

    async def disconnect_session(
        self,
        username: str,
        nas_ip: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Send Disconnect-Request (DM) to terminate a user session.

        Args:
            username: RADIUS username to disconnect
            nas_ip: NAS IP address (optional, helps with routing)
            session_id: Acct-Session-Id (optional, for specific session)

        Returns:
            Dictionary with result status

        Raises:
            Exception: If radclient is not available or request fails
        """
        attributes = [f'User-Name = "{username}"']

        if nas_ip:
            attributes.append(f"NAS-IP-Address = {nas_ip}")

        if session_id:
            attributes.append(f'Acct-Session-Id = "{session_id}"')

        try:
            result = await self._send_radclient_request(
                code="disconnect",
                attributes=attributes,
            )

            logger.info(
                "radius_disconnect_sent",
                username=username,
                nas_ip=nas_ip,
                session_id=session_id,
                result=result,
            )

            return {
                "success": True,
                "message": "Disconnect request sent successfully",
                "username": username,
                "details": result,
            }

        except Exception as e:
            logger.error(
                "radius_disconnect_failed",
                username=username,
                error=str(e),
                exc_info=True,
            )

            return {
                "success": False,
                "message": f"Failed to send disconnect request: {str(e)}",
                "username": username,
                "error": str(e),
            }

    async def change_bandwidth(
        self,
        username: str,
        download_kbps: int,
        upload_kbps: int,
        nas_ip: str | None = None,
    ) -> dict[str, Any]:
        """
        Send CoA request to change bandwidth limits.

        Args:
            username: RADIUS username
            download_kbps: Download speed in Kbps
            upload_kbps: Upload speed in Kbps
            nas_ip: NAS IP address

        Returns:
            Dictionary with result status
        """
        # Convert Kbps to rate-limit string format
        # Format: download/upload (in Kbps)
        rate_limit = f"{download_kbps}/{upload_kbps}"

        attributes = [
            f'User-Name = "{username}"',
            f'Filter-Id = "{rate_limit}"',  # Vendor-specific, adjust for your NAS
        ]

        if nas_ip:
            attributes.append(f"NAS-IP-Address = {nas_ip}")

        try:
            result = await self._send_radclient_request(
                code="coa",
                attributes=attributes,
            )

            logger.info(
                "radius_coa_bandwidth_sent",
                username=username,
                download_kbps=download_kbps,
                upload_kbps=upload_kbps,
                result=result,
            )

            return {
                "success": True,
                "message": "CoA bandwidth update sent successfully",
                "username": username,
                "download_kbps": download_kbps,
                "upload_kbps": upload_kbps,
                "details": result,
            }

        except Exception as e:
            logger.error(
                "radius_coa_bandwidth_failed",
                username=username,
                error=str(e),
                exc_info=True,
            )

            return {
                "success": False,
                "message": f"Failed to send CoA request: {str(e)}",
                "username": username,
                "error": str(e),
            }

    async def _send_radclient_request(
        self,
        code: str,
        attributes: list[str],
    ) -> str:
        """
        Send RADIUS packet using radclient command.

        Args:
            code: RADIUS code (disconnect, coa)
            attributes: List of RADIUS attribute strings

        Returns:
            radclient output

        Raises:
            FileNotFoundError: If radclient is not installed
            subprocess.CalledProcessError: If radclient fails
        """
        # Build radclient input (one attribute per line)
        radclient_input = "\n".join(attributes)

        # Build radclient command
        # radclient -x <server>:<port> <code> <secret>
        server_port = f"{self.radius_server}:{self.coa_port}"

        cmd = [
            "radclient",
            "-x",  # Debug output
            "-t",
            str(self.timeout),  # Timeout
            server_port,
            code,
            self.radius_secret,
        ]

        # Run radclient
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await process.communicate(input=radclient_input.encode())

        if process.returncode != 0:
            error_msg = stderr.decode() if stderr else "Unknown error"
            raise RuntimeError(f"radclient failed: {error_msg}")

        return stdout.decode()


class CoAClientHTTP:
    """
    Alternative CoA implementation using HTTP API.

    Some RADIUS servers (like FreeRADIUS 3.2+) can expose a REST API
    for CoA/DM operations. This client uses that instead of radclient.

    This is useful when:
    - radclient is not available in container
    - You want centralized CoA server
    - You need queuing and retry logic
    """

    def __init__(
        self,
        api_url: str = "http://localhost:8080/coa",
        api_key: str | None = None,
        timeout: int = 5,
    ):
        """
        Initialize HTTP CoA client.

        Args:
            api_url: CoA API endpoint URL
            api_key: API authentication key
            timeout: Request timeout in seconds
        """
        self.api_url = api_url
        self.api_key = api_key
        self.timeout = timeout

    async def disconnect_session(
        self,
        username: str,
        nas_ip: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Send disconnect request via HTTP API.

        Args:
            username: RADIUS username to disconnect
            nas_ip: NAS IP address
            session_id: Acct-Session-Id

        Returns:
            Dictionary with result status
        """
        payload = {
            "action": "disconnect",
            "username": username,
            "nas_ip": nas_ip,
            "session_id": session_id,
        }

        try:
            async with httpx.AsyncClient() as client:
                headers = {}
                if self.api_key:
                    headers["Authorization"] = f"Bearer {self.api_key}"

                response = await client.post(
                    f"{self.api_url}/disconnect",
                    json=payload,
                    headers=headers,
                    timeout=self.timeout,
                )

                response.raise_for_status()
                result = response.json()

                logger.info(
                    "radius_disconnect_http_sent",
                    username=username,
                    result=result,
                )

                return {
                    "success": True,
                    "message": "Disconnect request sent via HTTP API",
                    "username": username,
                    "details": result,
                }

        except Exception as e:
            logger.error(
                "radius_disconnect_http_failed",
                username=username,
                error=str(e),
                exc_info=True,
            )

            return {
                "success": False,
                "message": f"Failed to send disconnect via HTTP: {str(e)}",
                "username": username,
                "error": str(e),
            }


async def disconnect_session_helper(
    username: str,
    nas_ip: str | None = None,
    session_id: str | None = None,
    radius_server: str = "localhost",
    coa_port: int = 3799,
    radius_secret: str = "testing123",
    use_http: bool = False,
    http_api_url: str | None = None,
) -> dict[str, Any]:
    """
    Helper function to disconnect a RADIUS session.

    Automatically chooses between radclient and HTTP API based on configuration.

    Args:
        username: RADIUS username to disconnect
        nas_ip: NAS IP address
        session_id: Acct-Session-Id
        radius_server: RADIUS server hostname/IP
        coa_port: CoA port number
        radius_secret: RADIUS shared secret
        use_http: Use HTTP API instead of radclient
        http_api_url: HTTP API endpoint URL

    Returns:
        Dictionary with disconnect result
    """
    if use_http and http_api_url:
        http_client = CoAClientHTTP(api_url=http_api_url)
        return await http_client.disconnect_session(
            username=username,
            nas_ip=nas_ip,
            session_id=session_id,
        )
    else:
        radclient = CoAClient(
            radius_server=radius_server,
            coa_port=coa_port,
            radius_secret=radius_secret,
        )
        return await radclient.disconnect_session(
            username=username,
            nas_ip=nas_ip,
            session_id=session_id,
        )
