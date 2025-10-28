import uuid

import pytest

from dotmac.platform.secrets import SymmetricEncryptionService, VaultError
from dotmac.platform.wireguard.models import WireGuardServer
from dotmac.platform.wireguard.service import WireGuardService








pytestmark = pytest.mark.integration

class FakeWireGuardClient:
    """Minimal WireGuard client stub for tests."""

    async def generate_keypair(self):
        return "priv-key", "pub-key"


class FakeVaultClient:
    """Vault client stub that records stored secrets."""

    def __init__(self, should_fail: bool = False):
        self.should_fail = should_fail
        self.stored = {}

    async def set_secret(self, path: str, data: dict):
        if self.should_fail:
            raise VaultError("simulated failure")
        self.stored[path] = data


@pytest.mark.asyncio
async def test_create_server_with_encryption_fallback(async_db_session):
    tenant_id = uuid.uuid4()
    encryption = SymmetricEncryptionService(secret="test-secret")
    service = WireGuardService(
        session=async_db_session,
        client=FakeWireGuardClient(),
        tenant_id=tenant_id,
        encryption_service=encryption,
        vault_client=None,
    )

    server = await service.create_server(
        name="wg-test",
        public_endpoint="vpn.example.com:51820",
        server_ipv4="10.0.0.1/24",
        description="test server",
        location="test-lab",
    )

    assert isinstance(server, WireGuardServer)
    assert server.public_key == "pub-key"
    assert server.private_key_encrypted
    # Encrypted data should not match the raw private key
    assert server.private_key_encrypted != "priv-key"


@pytest.mark.asyncio
async def test_create_server_with_vault_storage(async_db_session):
    tenant_id = uuid.uuid4()
    vault = FakeVaultClient()
    service = WireGuardService(
        session=async_db_session,
        client=FakeWireGuardClient(),
        tenant_id=tenant_id,
        encryption_service=None,
        vault_client=vault,
    )

    server = await service.create_server(
        name="wg-vault",
        public_endpoint="vpn.example.com:51820",
        server_ipv4="10.1.0.1/24",
    )

    assert server.private_key_encrypted.startswith("vault:")
    assert len(vault.stored) == 1
    stored_path, stored_value = next(iter(vault.stored.items()))
    assert stored_path in server.private_key_encrypted
    assert stored_value["private_key"] == "priv-key"


@pytest.mark.asyncio
async def test_create_server_falls_back_when_vault_fails(async_db_session):
    tenant_id = uuid.uuid4()
    vault = FakeVaultClient(should_fail=True)
    encryption = SymmetricEncryptionService(secret="fallback-secret")
    service = WireGuardService(
        session=async_db_session,
        client=FakeWireGuardClient(),
        tenant_id=tenant_id,
        encryption_service=encryption,
        vault_client=vault,
    )

    server = await service.create_server(
        name="wg-fallback",
        public_endpoint="vpn.example.com:51820",
        server_ipv4="10.2.0.1/24",
    )

    # Vault failure should result in encrypted database storage
    assert server.private_key_encrypted
    assert not server.private_key_encrypted.startswith("vault:")
