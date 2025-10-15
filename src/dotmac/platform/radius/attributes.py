"""
RADIUS Attribute Dictionary

Defines standard RADIUS attributes and vendor-specific attributes (VSAs)
for use with FreeRADIUS and other RADIUS servers.

References:
- RFC 2865: RADIUS (Base attributes)
- RFC 2866: RADIUS Accounting
- RFC 2869: RADIUS Extensions
- RFC 3162: RADIUS and IPv6
- RFC 5176: Dynamic Authorization Extensions (CoA/DM)
"""

from enum import Enum
from typing import Any


class RADIUSAttributeType(str, Enum):
    """RADIUS attribute data types."""

    STRING = "string"
    INTEGER = "integer"
    IPADDR = "ipaddr"
    DATE = "date"
    OCTETS = "octets"
    IPV6ADDR = "ipv6addr"
    IPV6PREFIX = "ipv6prefix"
    IFID = "ifid"
    INTEGER64 = "integer64"


class RADIUSOperator(str, Enum):
    """RADIUS attribute operators."""

    EQUAL = "="  # Set to value (reply)
    CHECK = ":="  # Check equals (check)
    ADD = "+="  # Add to existing
    SUBTRACT = "-="  # Subtract from existing
    SET = ":="  # Set unconditionally
    NOT_EQUAL = "!="  # Not equal
    GREATER_THAN = ">"  # Greater than
    GREATER_EQUAL = ">="  # Greater or equal
    LESS_THAN = "<"  # Less than
    LESS_EQUAL = "<="  # Less or equal
    REGEX_MATCH = "=~"  # Regex match
    REGEX_NOT_MATCH = "!~"  # Regex not match


class StandardAttribute:
    """Standard RADIUS attribute definition."""

    def __init__(
        self,
        name: str,
        number: int,
        attr_type: RADIUSAttributeType,
        description: str,
        check_item: bool = False,
        reply_item: bool = False,
    ):
        self.name = name
        self.number = number
        self.attr_type = attr_type
        self.description = description
        self.check_item = check_item
        self.reply_item = reply_item

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "name": self.name,
            "number": self.number,
            "type": self.attr_type.value,
            "description": self.description,
            "check_item": self.check_item,
            "reply_item": self.reply_item,
        }


class VendorAttribute:
    """Vendor-specific RADIUS attribute definition."""

    def __init__(
        self,
        vendor_id: int,
        vendor_name: str,
        attr_id: int,
        attr_name: str,
        attr_type: RADIUSAttributeType,
        description: str,
    ):
        self.vendor_id = vendor_id
        self.vendor_name = vendor_name
        self.attr_id = attr_id
        self.attr_name = attr_name
        self.attr_type = attr_type
        self.description = description

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "vendor_id": self.vendor_id,
            "vendor_name": self.vendor_name,
            "attr_id": self.attr_id,
            "attr_name": self.attr_name,
            "type": self.attr_type.value,
            "description": self.description,
        }


# =============================================================================
# Standard RADIUS Attributes (RFC 2865)
# =============================================================================

STANDARD_ATTRIBUTES = {
    # Authentication attributes
    "User-Name": StandardAttribute(
        "User-Name",
        1,
        RADIUSAttributeType.STRING,
        "Username for authentication",
        check_item=True,
    ),
    "User-Password": StandardAttribute(
        "User-Password",
        2,
        RADIUSAttributeType.STRING,
        "User password (encrypted)",
        check_item=True,
    ),
    "CHAP-Password": StandardAttribute(
        "CHAP-Password",
        3,
        RADIUSAttributeType.OCTETS,
        "CHAP encrypted password",
        check_item=True,
    ),
    # Network attributes
    "NAS-IP-Address": StandardAttribute(
        "NAS-IP-Address",
        4,
        RADIUSAttributeType.IPADDR,
        "IP address of NAS",
        check_item=True,
    ),
    "NAS-Port": StandardAttribute(
        "NAS-Port",
        5,
        RADIUSAttributeType.INTEGER,
        "Physical port number of NAS",
    ),
    "Service-Type": StandardAttribute(
        "Service-Type",
        6,
        RADIUSAttributeType.INTEGER,
        "Type of service requested",
        check_item=True,
        reply_item=True,
    ),
    "Framed-Protocol": StandardAttribute(
        "Framed-Protocol",
        7,
        RADIUSAttributeType.INTEGER,
        "Framing protocol (PPP, SLIP, etc)",
        reply_item=True,
    ),
    "Framed-IP-Address": StandardAttribute(
        "Framed-IP-Address",
        8,
        RADIUSAttributeType.IPADDR,
        "IP address to assign to user",
        reply_item=True,
    ),
    "Framed-IP-Netmask": StandardAttribute(
        "Framed-IP-Netmask",
        9,
        RADIUSAttributeType.IPADDR,
        "IP netmask for user",
        reply_item=True,
    ),
    "Framed-Routing": StandardAttribute(
        "Framed-Routing",
        10,
        RADIUSAttributeType.INTEGER,
        "Routing method for user",
        reply_item=True,
    ),
    "Filter-Id": StandardAttribute(
        "Filter-Id",
        11,
        RADIUSAttributeType.STRING,
        "Name of filter list for user",
        reply_item=True,
    ),
    "Framed-MTU": StandardAttribute(
        "Framed-MTU",
        12,
        RADIUSAttributeType.INTEGER,
        "MTU for user",
        reply_item=True,
    ),
    "Framed-Compression": StandardAttribute(
        "Framed-Compression",
        13,
        RADIUSAttributeType.INTEGER,
        "Compression protocol",
        reply_item=True,
    ),
    # Session control
    "Login-IP-Host": StandardAttribute(
        "Login-IP-Host",
        14,
        RADIUSAttributeType.IPADDR,
        "IP address for user login",
        reply_item=True,
    ),
    "Login-Service": StandardAttribute(
        "Login-Service",
        15,
        RADIUSAttributeType.INTEGER,
        "Service for login",
        reply_item=True,
    ),
    "Login-TCP-Port": StandardAttribute(
        "Login-TCP-Port",
        16,
        RADIUSAttributeType.INTEGER,
        "TCP port for login",
        reply_item=True,
    ),
    # Response attributes
    "Reply-Message": StandardAttribute(
        "Reply-Message",
        18,
        RADIUSAttributeType.STRING,
        "Message to display to user",
        reply_item=True,
    ),
    "Callback-Number": StandardAttribute(
        "Callback-Number",
        19,
        RADIUSAttributeType.STRING,
        "Callback phone number",
        reply_item=True,
    ),
    "Callback-Id": StandardAttribute(
        "Callback-Id",
        20,
        RADIUSAttributeType.STRING,
        "Callback identifier",
        reply_item=True,
    ),
    # Framed route
    "Framed-Route": StandardAttribute(
        "Framed-Route",
        22,
        RADIUSAttributeType.STRING,
        "Routing information",
        reply_item=True,
    ),
    "Framed-IPX-Network": StandardAttribute(
        "Framed-IPX-Network",
        23,
        RADIUSAttributeType.IPADDR,
        "IPX network number",
        reply_item=True,
    ),
    # Session state
    "State": StandardAttribute(
        "State",
        24,
        RADIUSAttributeType.OCTETS,
        "State information for multi-round auth",
    ),
    "Class": StandardAttribute(
        "Class",
        25,
        RADIUSAttributeType.OCTETS,
        "Class attribute for grouping",
        reply_item=True,
    ),
    # Vendor specific
    "Vendor-Specific": StandardAttribute(
        "Vendor-Specific",
        26,
        RADIUSAttributeType.OCTETS,
        "Vendor-specific attributes",
    ),
    # Timeouts
    "Session-Timeout": StandardAttribute(
        "Session-Timeout",
        27,
        RADIUSAttributeType.INTEGER,
        "Maximum session duration (seconds)",
        reply_item=True,
    ),
    "Idle-Timeout": StandardAttribute(
        "Idle-Timeout",
        28,
        RADIUSAttributeType.INTEGER,
        "Maximum idle time (seconds)",
        reply_item=True,
    ),
    "Termination-Action": StandardAttribute(
        "Termination-Action",
        29,
        RADIUSAttributeType.INTEGER,
        "Action on termination",
        reply_item=True,
    ),
    # Identification
    "Called-Station-Id": StandardAttribute(
        "Called-Station-Id",
        30,
        RADIUSAttributeType.STRING,
        "Phone number or MAC of NAS",
    ),
    "Calling-Station-Id": StandardAttribute(
        "Calling-Station-Id",
        31,
        RADIUSAttributeType.STRING,
        "Phone number or MAC of user",
    ),
    "NAS-Identifier": StandardAttribute(
        "NAS-Identifier",
        32,
        RADIUSAttributeType.STRING,
        "String identifying the NAS",
    ),
    # Accounting
    "Proxy-State": StandardAttribute(
        "Proxy-State",
        33,
        RADIUSAttributeType.OCTETS,
        "Proxy state information",
    ),
    "Login-LAT-Service": StandardAttribute(
        "Login-LAT-Service",
        34,
        RADIUSAttributeType.STRING,
        "LAT service name",
        reply_item=True,
    ),
    "Login-LAT-Node": StandardAttribute(
        "Login-LAT-Node",
        35,
        RADIUSAttributeType.STRING,
        "LAT node ID",
        reply_item=True,
    ),
    "Login-LAT-Group": StandardAttribute(
        "Login-LAT-Group",
        36,
        RADIUSAttributeType.OCTETS,
        "LAT group code",
        reply_item=True,
    ),
    "Framed-AppleTalk-Link": StandardAttribute(
        "Framed-AppleTalk-Link",
        37,
        RADIUSAttributeType.INTEGER,
        "AppleTalk network number",
        reply_item=True,
    ),
    "Framed-AppleTalk-Network": StandardAttribute(
        "Framed-AppleTalk-Network",
        38,
        RADIUSAttributeType.INTEGER,
        "AppleTalk network number range",
        reply_item=True,
    ),
    "Framed-AppleTalk-Zone": StandardAttribute(
        "Framed-AppleTalk-Zone",
        39,
        RADIUSAttributeType.STRING,
        "AppleTalk default zone",
        reply_item=True,
    ),
    # Accounting attributes (RFC 2866)
    "Acct-Status-Type": StandardAttribute(
        "Acct-Status-Type",
        40,
        RADIUSAttributeType.INTEGER,
        "Accounting status (Start/Stop/Interim)",
    ),
    "Acct-Delay-Time": StandardAttribute(
        "Acct-Delay-Time",
        41,
        RADIUSAttributeType.INTEGER,
        "Delay in sending accounting",
    ),
    "Acct-Input-Octets": StandardAttribute(
        "Acct-Input-Octets",
        42,
        RADIUSAttributeType.INTEGER,
        "Octets received from user",
    ),
    "Acct-Output-Octets": StandardAttribute(
        "Acct-Output-Octets",
        43,
        RADIUSAttributeType.INTEGER,
        "Octets sent to user",
    ),
    "Acct-Session-Id": StandardAttribute(
        "Acct-Session-Id",
        44,
        RADIUSAttributeType.STRING,
        "Unique accounting session ID",
    ),
    "Acct-Authentic": StandardAttribute(
        "Acct-Authentic",
        45,
        RADIUSAttributeType.INTEGER,
        "How user was authenticated",
    ),
    "Acct-Session-Time": StandardAttribute(
        "Acct-Session-Time",
        46,
        RADIUSAttributeType.INTEGER,
        "Session duration (seconds)",
    ),
    "Acct-Input-Packets": StandardAttribute(
        "Acct-Input-Packets",
        47,
        RADIUSAttributeType.INTEGER,
        "Packets received from user",
    ),
    "Acct-Output-Packets": StandardAttribute(
        "Acct-Output-Packets",
        48,
        RADIUSAttributeType.INTEGER,
        "Packets sent to user",
    ),
    "Acct-Terminate-Cause": StandardAttribute(
        "Acct-Terminate-Cause",
        49,
        RADIUSAttributeType.INTEGER,
        "Reason for session termination",
    ),
    "Acct-Multi-Session-Id": StandardAttribute(
        "Acct-Multi-Session-Id",
        50,
        RADIUSAttributeType.STRING,
        "Multi-link session ID",
    ),
    "Acct-Link-Count": StandardAttribute(
        "Acct-Link-Count",
        51,
        RADIUSAttributeType.INTEGER,
        "Number of links in multilink session",
    ),
    "Acct-Input-Gigawords": StandardAttribute(
        "Acct-Input-Gigawords",
        52,
        RADIUSAttributeType.INTEGER,
        "Input octets overflow (gigawords)",
    ),
    "Acct-Output-Gigawords": StandardAttribute(
        "Acct-Output-Gigawords",
        53,
        RADIUSAttributeType.INTEGER,
        "Output octets overflow (gigawords)",
    ),
    # IPv6 attributes (RFC 3162)
    "Framed-IPv6-Prefix": StandardAttribute(
        "Framed-IPv6-Prefix",
        97,
        RADIUSAttributeType.IPV6PREFIX,
        "IPv6 prefix to assign",
        reply_item=True,
    ),
    "Framed-IPv6-Route": StandardAttribute(
        "Framed-IPv6-Route",
        99,
        RADIUSAttributeType.STRING,
        "IPv6 routing information",
        reply_item=True,
    ),
    "Delegated-IPv6-Prefix": StandardAttribute(
        "Delegated-IPv6-Prefix",
        123,
        RADIUSAttributeType.IPV6PREFIX,
        "Delegated IPv6 prefix",
        reply_item=True,
    ),
}


# =============================================================================
# Vendor-Specific Attributes (VSAs)
# =============================================================================

# Mikrotik VSAs (Vendor ID: 14988)
MIKROTIK_ATTRIBUTES = {
    "Mikrotik-Recv-Limit": VendorAttribute(
        14988,
        "Mikrotik",
        1,
        "Mikrotik-Recv-Limit",
        RADIUSAttributeType.INTEGER,
        "Download speed limit (bps)",
    ),
    "Mikrotik-Xmit-Limit": VendorAttribute(
        14988,
        "Mikrotik",
        2,
        "Mikrotik-Xmit-Limit",
        RADIUSAttributeType.INTEGER,
        "Upload speed limit (bps)",
    ),
    "Mikrotik-Group": VendorAttribute(
        14988,
        "Mikrotik",
        3,
        "Mikrotik-Group",
        RADIUSAttributeType.STRING,
        "User group name",
    ),
    "Mikrotik-Wireless-Forward": VendorAttribute(
        14988,
        "Mikrotik",
        4,
        "Mikrotik-Wireless-Forward",
        RADIUSAttributeType.INTEGER,
        "Allow wireless forwarding",
    ),
    "Mikrotik-Wireless-Skip-Dot1x": VendorAttribute(
        14988,
        "Mikrotik",
        5,
        "Mikrotik-Wireless-Skip-Dot1x",
        RADIUSAttributeType.INTEGER,
        "Skip 802.1X authentication",
    ),
    "Mikrotik-Wireless-Enc-Algo": VendorAttribute(
        14988,
        "Mikrotik",
        6,
        "Mikrotik-Wireless-Enc-Algo",
        RADIUSAttributeType.STRING,
        "Wireless encryption algorithm",
    ),
    "Mikrotik-Wireless-Enc-Key": VendorAttribute(
        14988,
        "Mikrotik",
        7,
        "Mikrotik-Wireless-Enc-Key",
        RADIUSAttributeType.STRING,
        "Wireless encryption key",
    ),
    "Mikrotik-Rate-Limit": VendorAttribute(
        14988,
        "Mikrotik",
        8,
        "Mikrotik-Rate-Limit",
        RADIUSAttributeType.STRING,
        "Rate limit (format: rx-rate[/tx-rate] [rx-burst-rate[/tx-burst-rate]])",
    ),
    "Mikrotik-Address-List": VendorAttribute(
        14988,
        "Mikrotik",
        9,
        "Mikrotik-Address-List",
        RADIUSAttributeType.STRING,
        "Add IP to address list",
    ),
    "Mikrotik-Delegated-IPv6-Pool": VendorAttribute(
        14988,
        "Mikrotik",
        10,
        "Mikrotik-Delegated-IPv6-Pool",
        RADIUSAttributeType.STRING,
        "IPv6 pool name for delegation",
    ),
}

# Cisco VSAs (Vendor ID: 9)
CISCO_ATTRIBUTES = {
    "Cisco-AVPair": VendorAttribute(
        9,
        "Cisco",
        1,
        "Cisco-AVPair",
        RADIUSAttributeType.STRING,
        "Cisco AV pair (key=value)",
    ),
    "Cisco-Account-Info": VendorAttribute(
        9,
        "Cisco",
        250,
        "Cisco-Account-Info",
        RADIUSAttributeType.STRING,
        "Account information",
    ),
}

# WISPr VSAs (Vendor ID: 14122) - For hotspot/captive portal
WISPR_ATTRIBUTES = {
    "WISPr-Location-ID": VendorAttribute(
        14122,
        "WISPr",
        1,
        "WISPr-Location-ID",
        RADIUSAttributeType.STRING,
        "Hotspot location identifier",
    ),
    "WISPr-Location-Name": VendorAttribute(
        14122,
        "WISPr",
        2,
        "WISPr-Location-Name",
        RADIUSAttributeType.STRING,
        "Hotspot location name",
    ),
    "WISPr-Bandwidth-Max-Down": VendorAttribute(
        14122,
        "WISPr",
        7,
        "WISPr-Bandwidth-Max-Down",
        RADIUSAttributeType.INTEGER,
        "Maximum download bandwidth (bps)",
    ),
    "WISPr-Bandwidth-Max-Up": VendorAttribute(
        14122,
        "WISPr",
        8,
        "WISPr-Bandwidth-Max-Up",
        RADIUSAttributeType.INTEGER,
        "Maximum upload bandwidth (bps)",
    ),
    "WISPr-Session-Terminate-Time": VendorAttribute(
        14122,
        "WISPr",
        9,
        "WISPr-Session-Terminate-Time",
        RADIUSAttributeType.STRING,
        "Session termination time (ISO 8601)",
    ),
}


# =============================================================================
# Attribute Registry
# =============================================================================


class RADIUSAttributeRegistry:
    """Registry for RADIUS attributes."""

    def __init__(self) -> None:
        self.standard_attrs = STANDARD_ATTRIBUTES
        self.vendor_attrs: dict[str, VendorAttribute] = {}

        # Register vendor attributes
        for attrs in [MIKROTIK_ATTRIBUTES, CISCO_ATTRIBUTES, WISPR_ATTRIBUTES]:
            self.vendor_attrs.update(attrs)

    def get_standard_attribute(self, name: str) -> StandardAttribute | None:
        """Get standard attribute by name."""
        return self.standard_attrs.get(name)

    def get_vendor_attribute(self, name: str) -> VendorAttribute | None:
        """Get vendor attribute by name."""
        return self.vendor_attrs.get(name)

    def list_standard_attributes(self) -> list[dict[str, Any]]:
        """List all standard attributes."""
        return [attr.to_dict() for attr in self.standard_attrs.values()]

    def list_vendor_attributes(self, vendor_id: int | None = None) -> list[dict[str, Any]]:
        """List vendor attributes, optionally filtered by vendor ID."""
        attrs: list[VendorAttribute] = list(self.vendor_attrs.values())
        if vendor_id is not None:
            attrs = [attr for attr in attrs if attr.vendor_id == vendor_id]
        return [attr.to_dict() for attr in attrs]

    def list_check_items(self) -> list[dict[str, Any]]:
        """List attributes that can be used in radcheck."""
        return [attr.to_dict() for attr in self.standard_attrs.values() if attr.check_item]

    def list_reply_items(self) -> list[dict[str, Any]]:
        """List attributes that can be used in radreply."""
        return [attr.to_dict() for attr in self.standard_attrs.values() if attr.reply_item]


# Global registry instance
registry = RADIUSAttributeRegistry()
