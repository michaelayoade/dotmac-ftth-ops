"""
IP Address Validation Module

Provides comprehensive IPv4 and IPv6 validation utilities with Pydantic field validators.
Supports:
- IPv4 address validation
- IPv6 address validation (full and compressed)
- CIDR notation validation (IPv4 and IPv6)
- Dual-stack validation
- Reusable Pydantic validators
"""

import ipaddress

# ============================================================================
# Core Validation Functions
# ============================================================================


def is_valid_ipv4(address: str) -> bool:
    """
    Validate IPv4 address.

    Args:
        address: IPv4 address string (e.g., "192.168.1.1")

    Returns:
        True if valid IPv4 address, False otherwise

    Examples:
        >>> is_valid_ipv4("192.168.1.1")
        True
        >>> is_valid_ipv4("256.1.1.1")
        False
        >>> is_valid_ipv4("2001:db8::1")
        False
    """
    try:
        ipaddress.IPv4Address(address)
        return True
    except (ipaddress.AddressValueError, ValueError):
        return False


def is_valid_ipv6(address: str) -> bool:
    """
    Validate IPv6 address (supports full and compressed format).

    Args:
        address: IPv6 address string (e.g., "2001:db8::1")

    Returns:
        True if valid IPv6 address, False otherwise

    Examples:
        >>> is_valid_ipv6("2001:db8::1")
        True
        >>> is_valid_ipv6("::1")
        True
        >>> is_valid_ipv6("192.168.1.1")
        False
    """
    try:
        ipaddress.IPv6Address(address)
        return True
    except (ipaddress.AddressValueError, ValueError):
        return False


def is_valid_ipv4_network(cidr: str, strict: bool = True) -> bool:
    """
    Validate IPv4 CIDR notation.

    Args:
        cidr: IPv4 CIDR string (e.g., "192.168.1.0/24")
        strict: If True, host bits must be zero

    Returns:
        True if valid IPv4 network, False otherwise

    Examples:
        >>> is_valid_ipv4_network("192.168.1.0/24")
        True
        >>> is_valid_ipv4_network("192.168.1.1/24", strict=False)
        True
        >>> is_valid_ipv4_network("192.168.1.1/24", strict=True)
        False
    """
    try:
        ipaddress.IPv4Network(cidr, strict=strict)
        return True
    except (ipaddress.AddressValueError, ipaddress.NetmaskValueError, ValueError):
        return False


def is_valid_ipv6_network(cidr: str, strict: bool = True) -> bool:
    """
    Validate IPv6 CIDR notation.

    Args:
        cidr: IPv6 CIDR string (e.g., "2001:db8::/32")
        strict: If True, host bits must be zero

    Returns:
        True if valid IPv6 network, False otherwise

    Examples:
        >>> is_valid_ipv6_network("2001:db8::/32")
        True
        >>> is_valid_ipv6_network("2001:db8::1/32", strict=False)
        True
        >>> is_valid_ipv6_network("2001:db8::1/32", strict=True)
        False
    """
    try:
        ipaddress.IPv6Network(cidr, strict=strict)
        return True
    except (ipaddress.AddressValueError, ipaddress.NetmaskValueError, ValueError):
        return False


def is_valid_ip(address: str) -> bool:
    """
    Validate IP address (IPv4 or IPv6).

    Args:
        address: IP address string

    Returns:
        True if valid IP address (v4 or v6), False otherwise
    """
    return is_valid_ipv4(address) or is_valid_ipv6(address)


def is_valid_ip_network(cidr: str, strict: bool = True) -> bool:
    """
    Validate IP network CIDR notation (IPv4 or IPv6).

    Args:
        cidr: CIDR string
        strict: If True, host bits must be zero

    Returns:
        True if valid network (v4 or v6), False otherwise
    """
    return is_valid_ipv4_network(cidr, strict) or is_valid_ipv6_network(cidr, strict)


def detect_ip_version(address: str) -> int | None:
    """
    Detect IP address version.

    Args:
        address: IP address string

    Returns:
        4 for IPv4, 6 for IPv6, None if invalid

    Examples:
        >>> detect_ip_version("192.168.1.1")
        4
        >>> detect_ip_version("2001:db8::1")
        6
        >>> detect_ip_version("invalid")
        None
    """
    if is_valid_ipv4(address):
        return 4
    if is_valid_ipv6(address):
        return 6
    return None


def normalize_ipv6(address: str) -> str | None:
    """
    Normalize IPv6 address to canonical format.

    Args:
        address: IPv6 address string (compressed or full)

    Returns:
        Normalized IPv6 address or None if invalid

    Examples:
        >>> normalize_ipv6("2001:db8::1")
        '2001:db8::1'
        >>> normalize_ipv6("2001:0db8:0000:0000:0000:0000:0000:0001")
        '2001:db8::1'
    """
    try:
        return str(ipaddress.IPv6Address(address))
    except (ipaddress.AddressValueError, ValueError):
        return None


def is_private_ip(address: str) -> bool:
    """
    Check if IP address is in private range.

    Args:
        address: IP address string

    Returns:
        True if private IP, False otherwise

    Examples:
        >>> is_private_ip("192.168.1.1")
        True
        >>> is_private_ip("8.8.8.8")
        False
        >>> is_private_ip("fd00::1")
        True
    """
    try:
        ip = ipaddress.ip_address(address)
        return ip.is_private
    except ValueError:
        return False


def is_loopback(address: str) -> bool:
    """
    Check if IP address is loopback.

    Args:
        address: IP address string

    Returns:
        True if loopback IP, False otherwise

    Examples:
        >>> is_loopback("127.0.0.1")
        True
        >>> is_loopback("::1")
        True
        >>> is_loopback("192.168.1.1")
        False
    """
    try:
        ip = ipaddress.ip_address(address)
        return ip.is_loopback
    except ValueError:
        return False


def is_multicast(address: str) -> bool:
    """
    Check if IP address is multicast.

    Args:
        address: IP address string

    Returns:
        True if multicast IP, False otherwise

    Examples:
        >>> is_multicast("224.0.0.1")
        True
        >>> is_multicast("ff02::1")
        True
        >>> is_multicast("192.168.1.1")
        False
    """
    try:
        ip = ipaddress.ip_address(address)
        return ip.is_multicast
    except ValueError:
        return False


def is_link_local(address: str) -> bool:
    """
    Check if IP address is link-local.

    Args:
        address: IP address string

    Returns:
        True if link-local IP, False otherwise

    Examples:
        >>> is_link_local("169.254.1.1")
        True
        >>> is_link_local("fe80::1")
        True
        >>> is_link_local("192.168.1.1")
        False
    """
    try:
        ip = ipaddress.ip_address(address)
        return ip.is_link_local
    except ValueError:
        return False


# ============================================================================
# Pydantic Field Validators (Reusable)
# ============================================================================


class IPv4AddressValidator:
    """Pydantic validator for IPv4 addresses."""

    @classmethod
    def validate(cls, v: str | None) -> str | None:
        """
        Validate IPv4 address field.

        Args:
            v: IPv4 address value

        Returns:
            Validated IPv4 address

        Raises:
            ValueError: If invalid IPv4 address
        """
        if v is None:
            return v

        if not isinstance(v, str):
            raise ValueError(f"IPv4 address must be a string, got {type(v).__name__}")

        v = v.strip()
        if not v:
            return None

        if not is_valid_ipv4(v):
            raise ValueError(f"Invalid IPv4 address: {v}")

        return v


class IPv6AddressValidator:
    """Pydantic validator for IPv6 addresses."""

    @classmethod
    def validate(cls, v: str | None) -> str | None:
        """
        Validate IPv6 address field.

        Args:
            v: IPv6 address value

        Returns:
            Normalized IPv6 address

        Raises:
            ValueError: If invalid IPv6 address
        """
        if v is None:
            return v

        if not isinstance(v, str):
            raise ValueError(f"IPv6 address must be a string, got {type(v).__name__}")

        v = v.strip()
        if not v:
            return None

        normalized = normalize_ipv6(v)
        if normalized is None:
            raise ValueError(f"Invalid IPv6 address: {v}")

        return normalized


class IPv4NetworkValidator:
    """Pydantic validator for IPv4 CIDR networks."""

    @classmethod
    def validate(cls, v: str | None, strict: bool = True) -> str | None:
        """
        Validate IPv4 network (CIDR) field.

        Args:
            v: IPv4 CIDR value
            strict: If True, host bits must be zero

        Returns:
            Validated IPv4 CIDR

        Raises:
            ValueError: If invalid IPv4 network
        """
        if v is None:
            return v

        if not isinstance(v, str):
            raise ValueError(f"IPv4 network must be a string, got {type(v).__name__}")

        v = v.strip()
        if not v:
            return None

        if not is_valid_ipv4_network(v, strict=strict):
            raise ValueError(f"Invalid IPv4 CIDR notation: {v}")

        return v


class IPv6NetworkValidator:
    """Pydantic validator for IPv6 CIDR networks."""

    @classmethod
    def validate(cls, v: str | None, strict: bool = True) -> str | None:
        """
        Validate IPv6 network (CIDR) field.

        Args:
            v: IPv6 CIDR value
            strict: If True, host bits must be zero

        Returns:
            Normalized IPv6 CIDR

        Raises:
            ValueError: If invalid IPv6 network
        """
        if v is None:
            return v

        if not isinstance(v, str):
            raise ValueError(f"IPv6 network must be a string, got {type(v).__name__}")

        v = v.strip()
        if not v:
            return None

        if not is_valid_ipv6_network(v, strict=strict):
            raise ValueError(f"Invalid IPv6 CIDR notation: {v}")

        # Normalize IPv6 part
        try:
            v.split("/")
            network = ipaddress.IPv6Network(v, strict=strict)
            return str(network)
        except Exception:
            raise ValueError(f"Invalid IPv6 CIDR notation: {v}")


class IPAddressValidator:
    """Pydantic validator for IP addresses (IPv4 or IPv6)."""

    @classmethod
    def validate(cls, v: str | None) -> str | None:
        """
        Validate IP address field (IPv4 or IPv6).

        Args:
            v: IP address value

        Returns:
            Validated IP address (normalized for IPv6)

        Raises:
            ValueError: If invalid IP address
        """
        if v is None:
            return v

        if not isinstance(v, str):
            raise ValueError(f"IP address must be a string, got {type(v).__name__}")

        v = v.strip()
        if not v:
            return None

        # Try IPv4 first
        if is_valid_ipv4(v):
            return v

        # Try IPv6
        normalized = normalize_ipv6(v)
        if normalized is not None:
            return normalized

        raise ValueError(f"Invalid IP address (must be IPv4 or IPv6): {v}")


class IPNetworkValidator:
    """Pydantic validator for IP networks (IPv4 or IPv6 CIDR)."""

    @classmethod
    def validate(cls, v: str | None, strict: bool = True) -> str | None:
        """
        Validate IP network field (IPv4 or IPv6 CIDR).

        Args:
            v: CIDR value
            strict: If True, host bits must be zero

        Returns:
            Validated CIDR notation

        Raises:
            ValueError: If invalid network
        """
        if v is None:
            return v

        if not isinstance(v, str):
            raise ValueError(f"IP network must be a string, got {type(v).__name__}")

        v = v.strip()
        if not v:
            return None

        # Try IPv4 first
        if is_valid_ipv4_network(v, strict=strict):
            return v

        # Try IPv6
        if is_valid_ipv6_network(v, strict=strict):
            try:
                network = ipaddress.IPv6Network(v, strict=strict)
                return str(network)
            except Exception:
                pass

        raise ValueError(f"Invalid IP network CIDR notation (must be IPv4 or IPv6): {v}")


# ============================================================================
# Convenience Functions for Common Use Cases
# ============================================================================


def validate_ipv4_address_field(v: str | None) -> str | None:
    """Shorthand for IPv4 address validation."""
    return IPv4AddressValidator.validate(v)


def validate_ipv6_address_field(v: str | None) -> str | None:
    """Shorthand for IPv6 address validation."""
    return IPv6AddressValidator.validate(v)


def validate_ipv4_network_field(v: str | None, strict: bool = True) -> str | None:
    """Shorthand for IPv4 network validation."""
    return IPv4NetworkValidator.validate(v, strict=strict)


def validate_ipv6_network_field(v: str | None, strict: bool = True) -> str | None:
    """Shorthand for IPv6 network validation."""
    return IPv6NetworkValidator.validate(v, strict=strict)


def validate_ip_address_field(v: str | None) -> str | None:
    """Shorthand for IP address validation (IPv4 or IPv6)."""
    return IPAddressValidator.validate(v)


def validate_ip_network_field(v: str | None, strict: bool = True) -> str | None:
    """Shorthand for IP network validation (IPv4 or IPv6 CIDR)."""
    return IPNetworkValidator.validate(v, strict=strict)


def validate_ip_network(cidr: str, strict: bool = True) -> None:
    """
    Validate IP network CIDR notation, raising ValueError if invalid.

    Args:
        cidr: CIDR string (e.g., "192.168.1.0/24" or "2001:db8::/32")
        strict: If True, host bits must be zero

    Raises:
        ValueError: If invalid network CIDR notation

    Examples:
        >>> validate_ip_network("192.168.1.0/24")  # No error
        >>> validate_ip_network("2001:db8::/32")  # No error
        >>> validate_ip_network("invalid")  # Raises ValueError
    """
    if not is_valid_ip_network(cidr, strict=strict):
        raise ValueError(f"Invalid IP network CIDR notation: {cidr}")


# ============================================================================
# Export All
# ============================================================================

__all__ = [
    # Core validation functions
    "is_valid_ipv4",
    "is_valid_ipv6",
    "is_valid_ipv4_network",
    "is_valid_ipv6_network",
    "is_valid_ip",
    "is_valid_ip_network",
    "detect_ip_version",
    "normalize_ipv6",
    "is_private_ip",
    "is_loopback",
    "is_multicast",
    "is_link_local",
    # Pydantic validators
    "IPv4AddressValidator",
    "IPv6AddressValidator",
    "IPv4NetworkValidator",
    "IPv6NetworkValidator",
    "IPAddressValidator",
    "IPNetworkValidator",
    # Convenience functions
    "validate_ipv4_address_field",
    "validate_ipv6_address_field",
    "validate_ipv4_network_field",
    "validate_ipv6_network_field",
    "validate_ip_address_field",
    "validate_ip_network_field",
    "validate_ip_network",
]
