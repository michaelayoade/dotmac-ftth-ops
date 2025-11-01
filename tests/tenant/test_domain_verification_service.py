# mypy: disable-error-code="no-untyped-def"
"""
Tests for domain verification service.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import dns.resolver
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.audit.models import ActivitySeverity, ActivityType
from dotmac.platform.audit.service import AuditService
from dotmac.platform.tenant.domain_verification import (
    DomainVerificationService,
    VerificationMethod,
)
from dotmac.platform.tenant.models import Tenant


@pytest.fixture
def mock_db_session():
    """Mock database session."""
    session = AsyncMock(spec=AsyncSession)
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()

    # Configure execute() for queries
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=None)
    session.execute = AsyncMock(return_value=mock_result)

    return session


@pytest.fixture
def mock_audit_service():
    """Mock audit service."""
    service = AsyncMock(spec=AuditService)
    service.log_activity = AsyncMock(spec=AuditService.log_activity)
    return service


@pytest.fixture
def domain_verification_service(mock_db_session, mock_audit_service):
    """Domain verification service with mocks."""
    return DomainVerificationService(
        db=mock_db_session,
        audit_service=mock_audit_service,
        verification_ttl_hours=72,
    )


@pytest.mark.integration
class TestTokenGeneration:
    """Test verification token generation."""

    def test_generate_verification_token(self, domain_verification_service):
        """Test token generation produces 32-char string."""
        token = domain_verification_service.generate_verification_token(
            tenant_id="tenant-123", domain="example.com"
        )

        assert isinstance(token, str)
        assert len(token) == 32
        assert token.isalnum()

    def test_generate_verification_token_uniqueness(self, domain_verification_service):
        """Test tokens are unique for different inputs."""
        token1 = domain_verification_service.generate_verification_token(
            tenant_id="tenant-123", domain="example.com"
        )
        token2 = domain_verification_service.generate_verification_token(
            tenant_id="tenant-456", domain="example.com"
        )
        token3 = domain_verification_service.generate_verification_token(
            tenant_id="tenant-123", domain="other.com"
        )

        assert token1 != token2
        assert token1 != token3
        assert token2 != token3


@pytest.mark.integration
class TestDomainValidation:
    """Test domain format validation."""

    def test_valid_domain(self, domain_verification_service):
        """Test valid domain formats pass validation."""
        valid_domains = [
            "example.com",
            "sub.example.com",
            "sub-domain.example.com",
            "example.co.uk",
            "a.b.c.example.com",
        ]

        for domain in valid_domains:
            assert domain_verification_service._is_valid_domain(domain) is True

    def test_invalid_domain_format(self, domain_verification_service):
        """Test invalid domain formats fail validation."""
        invalid_domains = [
            "",
            "invalid",
            ".com",
            "example.",
            "example .com",
            "example..com",
            "-example.com",
            "example-.com",
        ]

        for domain in invalid_domains:
            assert domain_verification_service._is_valid_domain(domain) is False

    def test_blocked_domains(self, domain_verification_service):
        """Test localhost and internal domains are blocked."""
        blocked_domains = [
            "localhost",
            "127.0.0.1",
            "0.0.0.0",
            "example.local",
            "test.internal",
        ]

        for domain in blocked_domains:
            assert domain_verification_service._is_valid_domain(domain) is False

    def test_domain_length_validation(self, domain_verification_service):
        """Test domain length limits."""
        # Too long
        long_domain = "a" * 256 + ".com"
        assert domain_verification_service._is_valid_domain(long_domain) is False

        # Valid length (under 255 chars total)
        valid_domain = "subdomain.example.com"
        assert domain_verification_service._is_valid_domain(valid_domain) is True


@pytest.mark.integration
class TestInitiateVerification:
    """Test initiating domain verification."""

    @pytest.mark.asyncio
    async def test_initiate_verification_success(
        self, domain_verification_service, mock_db_session, mock_audit_service
    ):
        """Test successful verification initiation."""
        # Mock tenant exists
        tenant = Tenant(id="tenant-123", name="Test Org")

        # Mock execute to handle both _get_tenant and _check_domain_exists queries
        def mock_execute_side_effect(query):
            mock_result = MagicMock()
            # First call - get tenant (exists)
            if mock_execute_side_effect.call_count == 1:
                mock_result.scalar_one_or_none = MagicMock(return_value=tenant)
            # Second call - check domain exists (not found)
            else:
                mock_result.scalar_one_or_none = MagicMock(return_value=None)
            return mock_result

        mock_execute_side_effect.call_count = 0

        async def execute_wrapper(query):
            mock_execute_side_effect.call_count += 1
            return mock_execute_side_effect(query)

        mock_db_session.execute = AsyncMock(side_effect=execute_wrapper)

        result = await domain_verification_service.initiate_verification(
            tenant_id="tenant-123",
            domain="example.com",
            method=VerificationMethod.DNS_TXT,
            user_id="user-123",
        )

        assert result["domain"] == "example.com"
        assert result["method"] == "dns_txt"
        assert result["status"] == "pending"
        assert "token" in result
        assert len(result["token"]) == 32
        assert "expires_at" in result
        assert "instructions" in result

        # Verify audit log
        mock_audit_service.log_activity.assert_called_once()
        call_args = mock_audit_service.log_activity.call_args
        assert call_args.kwargs["activity_type"] == ActivityType.API_REQUEST
        assert call_args.kwargs["action"] == "domain.verification.initiated"
        assert "initiated" in call_args.kwargs["description"]
        assert call_args.kwargs["resource_type"] == "domain"
        assert call_args.kwargs["severity"] == ActivitySeverity.MEDIUM

    @pytest.mark.asyncio
    async def test_initiate_verification_invalid_domain(
        self, domain_verification_service, mock_db_session
    ):
        """Test verification fails with invalid domain."""
        with pytest.raises(ValueError, match="Invalid domain format"):
            await domain_verification_service.initiate_verification(
                tenant_id="tenant-123",
                domain="invalid domain",
                method=VerificationMethod.DNS_TXT,
                user_id="user-123",
            )

    @pytest.mark.asyncio
    async def test_initiate_verification_tenant_not_found(
        self, domain_verification_service, mock_db_session
    ):
        """Test verification fails when tenant doesn't exist."""
        # Mock tenant not found
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(ValueError, match="Tenant .* not found"):
            await domain_verification_service.initiate_verification(
                tenant_id="nonexistent",
                domain="example.com",
                method=VerificationMethod.DNS_TXT,
                user_id="user-123",
            )

    @pytest.mark.asyncio
    async def test_initiate_verification_domain_already_verified(
        self, domain_verification_service, mock_db_session
    ):
        """Test verification fails if domain already verified for another tenant."""
        # Mock tenant exists
        tenant = Tenant(id="tenant-123", name="Test Org")

        # Mock domain exists for another tenant
        existing_tenant = Tenant(id="tenant-456", name="Other Org", domain="example.com")

        def mock_execute_side_effect(query):
            mock_result = MagicMock()
            # First call - get tenant (exists)
            # Second call - check domain exists (found)
            if mock_execute_side_effect.call_count == 1:
                mock_result.scalar_one_or_none = MagicMock(return_value=tenant)
            else:
                mock_result.scalar_one_or_none = MagicMock(return_value=existing_tenant)
            return mock_result

        mock_execute_side_effect.call_count = 0

        async def execute_wrapper(query):
            mock_execute_side_effect.call_count += 1
            return mock_execute_side_effect(query)

        mock_db_session.execute = AsyncMock(side_effect=execute_wrapper)

        with pytest.raises(ValueError, match="already verified for another tenant"):
            await domain_verification_service.initiate_verification(
                tenant_id="tenant-123",
                domain="example.com",
                method=VerificationMethod.DNS_TXT,
                user_id="user-123",
            )


@pytest.mark.integration
class TestDNSTXTVerification:
    """Test DNS TXT record verification."""

    @pytest.mark.asyncio
    async def test_verify_dns_txt_success(self, domain_verification_service):
        """Test successful DNS TXT verification."""
        expected_token = "abc123def456"
        txt_record = f"dotmac-verify={expected_token}"

        # Mock DNS response
        mock_record = MagicMock()
        mock_record.__str__ = MagicMock(return_value=f'"{txt_record}"')

        with patch.object(
            domain_verification_service.dns_resolver,
            "resolve",
            return_value=[mock_record],
        ):
            result = await domain_verification_service._verify_dns_txt(
                domain="example.com", expected_token=expected_token
            )

        assert result is True

    @pytest.mark.asyncio
    async def test_verify_dns_txt_token_without_prefix(self, domain_verification_service):
        """Test DNS TXT verification with token only (no prefix)."""
        expected_token = "abc123def456"

        # Mock DNS response with just token
        mock_record = MagicMock()
        mock_record.__str__ = MagicMock(return_value=f'"{expected_token}"')

        with patch.object(
            domain_verification_service.dns_resolver,
            "resolve",
            return_value=[mock_record],
        ):
            result = await domain_verification_service._verify_dns_txt(
                domain="example.com", expected_token=expected_token
            )

        assert result is True

    @pytest.mark.asyncio
    async def test_verify_dns_txt_wrong_token(self, domain_verification_service):
        """Test DNS TXT verification fails with wrong token."""
        expected_token = "abc123def456"
        wrong_token = "wrong-token"

        # Mock DNS response with wrong token
        mock_record = MagicMock()
        mock_record.__str__ = MagicMock(return_value=f'"dotmac-verify={wrong_token}"')

        with patch.object(
            domain_verification_service.dns_resolver,
            "resolve",
            return_value=[mock_record],
        ):
            result = await domain_verification_service._verify_dns_txt(
                domain="example.com", expected_token=expected_token
            )

        assert result is False

    @pytest.mark.asyncio
    async def test_verify_dns_txt_no_records(self, domain_verification_service):
        """Test DNS TXT verification fails when no records exist."""

        def mock_resolve(*args):
            raise dns.resolver.NoAnswer()

        with patch.object(
            domain_verification_service.dns_resolver, "resolve", side_effect=mock_resolve
        ):
            result = await domain_verification_service._verify_dns_txt(
                domain="example.com", expected_token="abc123"
            )

        assert result is False

    @pytest.mark.asyncio
    async def test_verify_dns_txt_domain_not_found(self, domain_verification_service):
        """Test DNS TXT verification fails when domain doesn't exist."""

        def mock_resolve(*args):
            raise dns.resolver.NXDOMAIN()

        with patch.object(
            domain_verification_service.dns_resolver, "resolve", side_effect=mock_resolve
        ):
            result = await domain_verification_service._verify_dns_txt(
                domain="nonexistent.example.com", expected_token="abc123"
            )

        assert result is False


@pytest.mark.integration
class TestDNSCNAMEVerification:
    """Test DNS CNAME record verification."""

    @pytest.mark.asyncio
    async def test_verify_dns_cname_success(self, domain_verification_service):
        """Test successful DNS CNAME verification."""
        expected_token = "abc123def456"
        tenant_id = "tenant-123"

        # Mock CNAME target
        expected_target = f"{expected_token}.verify.dotmac-platform.com"
        mock_record = MagicMock()
        mock_record.target = MagicMock()
        mock_record.target.__str__ = MagicMock(return_value=f"{expected_target}.")

        with patch.object(
            domain_verification_service.dns_resolver,
            "resolve",
            return_value=[mock_record],
        ):
            result = await domain_verification_service._verify_dns_cname(
                domain="example.com",
                expected_token=expected_token,
                tenant_id=tenant_id,
            )

        assert result is True

    @pytest.mark.asyncio
    async def test_verify_dns_cname_wrong_target(self, domain_verification_service):
        """Test DNS CNAME verification fails with wrong target."""
        expected_token = "abc123def456"
        tenant_id = "tenant-123"

        # Mock CNAME with wrong target
        wrong_target = "wrong-target.example.com"
        mock_record = MagicMock()
        mock_record.target = MagicMock()
        mock_record.target.__str__ = MagicMock(return_value=f"{wrong_target}.")

        with patch.object(
            domain_verification_service.dns_resolver,
            "resolve",
            return_value=[mock_record],
        ):
            result = await domain_verification_service._verify_dns_cname(
                domain="example.com",
                expected_token=expected_token,
                tenant_id=tenant_id,
            )

        assert result is False

    @pytest.mark.asyncio
    async def test_verify_dns_cname_no_records(self, domain_verification_service):
        """Test DNS CNAME verification fails when no records exist."""

        def mock_resolve(*args):
            raise dns.resolver.NoAnswer()

        with patch.object(
            domain_verification_service.dns_resolver, "resolve", side_effect=mock_resolve
        ):
            result = await domain_verification_service._verify_dns_cname(
                domain="example.com",
                expected_token="abc123",
                tenant_id="tenant-123",
            )

        assert result is False


@pytest.mark.integration
class TestVerifyDomain:
    """Test complete domain verification workflow."""

    @pytest.mark.asyncio
    async def test_verify_domain_txt_success(
        self, domain_verification_service, mock_db_session, mock_audit_service
    ):
        """Test successful domain verification with DNS TXT."""
        # Mock tenant exists
        tenant = Tenant(id="tenant-123", name="Test Org")
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=tenant)
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        # Mock successful DNS verification
        with patch.object(domain_verification_service, "_verify_dns_txt", return_value=True):
            result = await domain_verification_service.verify_domain(
                tenant_id="tenant-123",
                domain="example.com",
                token="abc123",
                method=VerificationMethod.DNS_TXT,
                user_id="user-123",
            )

        assert result["domain"] == "example.com"
        assert result["status"] == "verified"
        assert result["method"] == "dns_txt"
        assert "verified_at" in result

        # Verify tenant domain was updated
        assert tenant.domain == "example.com"
        mock_db_session.commit.assert_called_once()

        # Verify audit log
        mock_audit_service.log_activity.assert_called_once()
        call_args = mock_audit_service.log_activity.call_args
        assert call_args.kwargs["activity_type"] == ActivityType.API_REQUEST
        assert call_args.kwargs["action"] == "domain.verification.succeeded"
        assert "succeeded" in call_args.kwargs["description"]
        assert call_args.kwargs["severity"] == ActivitySeverity.LOW

    @pytest.mark.asyncio
    async def test_verify_domain_cname_success(
        self, domain_verification_service, mock_db_session, mock_audit_service
    ):
        """Test successful domain verification with DNS CNAME."""
        # Mock tenant exists
        tenant = Tenant(id="tenant-123", name="Test Org")
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=tenant)
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        # Mock successful DNS verification
        with patch.object(domain_verification_service, "_verify_dns_cname", return_value=True):
            result = await domain_verification_service.verify_domain(
                tenant_id="tenant-123",
                domain="example.com",
                token="abc123",
                method=VerificationMethod.DNS_CNAME,
                user_id="user-123",
            )

        assert result["status"] == "verified"
        assert result["method"] == "dns_cname"

    @pytest.mark.asyncio
    async def test_verify_domain_failure(
        self, domain_verification_service, mock_db_session, mock_audit_service
    ):
        """Test domain verification failure logs audit event."""
        # Mock tenant exists
        tenant = Tenant(id="tenant-123", name="Test Org")
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=tenant)
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        # Mock failed DNS verification
        with patch.object(domain_verification_service, "_verify_dns_txt", return_value=False):
            with pytest.raises(ValueError, match="Domain verification failed"):
                await domain_verification_service.verify_domain(
                    tenant_id="tenant-123",
                    domain="example.com",
                    token="abc123",
                    method=VerificationMethod.DNS_TXT,
                    user_id="user-123",
                )

        # Verify failure audit log
        mock_audit_service.log_activity.assert_called_once()
        call_args = mock_audit_service.log_activity.call_args
        assert call_args.kwargs["activity_type"] == ActivityType.API_ERROR
        assert call_args.kwargs["action"] == "domain.verification.failed"
        assert "failed" in call_args.kwargs["description"]
        assert call_args.kwargs["severity"] == ActivitySeverity.HIGH

    @pytest.mark.asyncio
    async def test_verify_domain_unsupported_method(
        self, domain_verification_service, mock_db_session
    ):
        """Test verification fails with unsupported method."""
        # Mock tenant exists
        tenant = Tenant(id="tenant-123", name="Test Org")
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=tenant)
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(ValueError, match="not yet implemented"):
            await domain_verification_service.verify_domain(
                tenant_id="tenant-123",
                domain="example.com",
                token="abc123",
                method=VerificationMethod.META_TAG,
                user_id="user-123",
            )


@pytest.mark.integration
class TestRemoveDomain:
    """Test domain removal."""

    @pytest.mark.asyncio
    async def test_remove_domain_success(
        self, domain_verification_service, mock_db_session, mock_audit_service
    ):
        """Test successful domain removal."""
        # Mock tenant with verified domain
        tenant = Tenant(id="tenant-123", name="Test Org", domain="example.com")
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=tenant)
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        result = await domain_verification_service.remove_domain(
            tenant_id="tenant-123",
            domain="example.com",
            user_id="user-123",
        )

        assert result["domain"] == "example.com"
        assert result["status"] == "removed"
        assert "removed_at" in result

        # Verify tenant domain was cleared
        assert tenant.domain is None
        mock_db_session.commit.assert_called_once()

        # Verify audit log
        mock_audit_service.log_activity.assert_called_once()
        call_args = mock_audit_service.log_activity.call_args
        assert call_args.kwargs["activity_type"] == ActivityType.API_REQUEST
        assert call_args.kwargs["action"] == "domain.removed"
        assert "removed" in call_args.kwargs["description"]
        assert call_args.kwargs["severity"] == ActivitySeverity.MEDIUM

    @pytest.mark.asyncio
    async def test_remove_domain_tenant_not_found(
        self, domain_verification_service, mock_db_session
    ):
        """Test removal fails when tenant doesn't exist."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(ValueError, match="Tenant .* not found"):
            await domain_verification_service.remove_domain(
                tenant_id="nonexistent",
                domain="example.com",
                user_id="user-123",
            )

    @pytest.mark.asyncio
    async def test_remove_domain_mismatch(self, domain_verification_service, mock_db_session):
        """Test removal fails when domain doesn't match tenant."""
        tenant = Tenant(id="tenant-123", name="Test Org", domain="other.com")
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=tenant)
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(ValueError, match="not associated with tenant"):
            await domain_verification_service.remove_domain(
                tenant_id="tenant-123",
                domain="example.com",
                user_id="user-123",
            )


@pytest.mark.integration
class TestVerificationInstructions:
    """Test verification instruction generation."""

    def test_get_dns_txt_instructions(self, domain_verification_service):
        """Test DNS TXT instructions are complete."""
        instructions = domain_verification_service._get_verification_instructions(
            domain="example.com",
            token="abc123",
            method=VerificationMethod.DNS_TXT,
        )

        assert instructions["type"] == "DNS TXT Record"
        assert "steps" in instructions
        assert len(instructions["steps"]) > 0
        assert "dns_record" in instructions
        assert instructions["dns_record"]["type"] == "TXT"
        assert "dotmac-verify=abc123" in instructions["dns_record"]["value"]
        assert "verification_command" in instructions

    def test_get_dns_cname_instructions(self, domain_verification_service):
        """Test DNS CNAME instructions are complete."""
        instructions = domain_verification_service._get_verification_instructions(
            domain="example.com",
            token="abc123",
            method=VerificationMethod.DNS_CNAME,
        )

        assert instructions["type"] == "DNS CNAME Record"
        assert "steps" in instructions
        assert len(instructions["steps"]) > 0
        assert "dns_record" in instructions
        assert instructions["dns_record"]["type"] == "CNAME"
        assert "_dotmac-verify.example.com" in instructions["dns_record"]["name"]
        assert "abc123.verify.dotmac-platform.com" in instructions["dns_record"]["target"]
