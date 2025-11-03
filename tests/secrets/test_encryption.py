"""Tests for secrets encryption module."""

import base64
import hashlib
from datetime import UTC, datetime
from unittest.mock import Mock, patch

import pytest

from dotmac.platform.secrets.encryption import (
    DataClassification,
    EncryptedField,
    SymmetricEncryptionService,
)


@pytest.mark.unit
class TestDataClassification:
    """Test DataClassification enum."""

    def test_classification_values(self):
        """Test that classification values are correct."""
        assert DataClassification.PUBLIC == "public"
        assert DataClassification.INTERNAL == "internal"
        assert DataClassification.CONFIDENTIAL == "confidential"
        assert DataClassification.RESTRICTED == "restricted"

    def test_classification_membership(self):
        """Test that all expected classifications exist."""
        expected = {"public", "internal", "confidential", "restricted"}
        actual = {item.value for item in DataClassification}
        assert actual == expected

    def test_classification_string_behavior(self):
        """Test that classifications behave as strings."""
        classification = DataClassification.CONFIDENTIAL
        assert classification.value == "confidential"
        assert classification == "confidential"


@pytest.mark.unit
class TestEncryptedField:
    """Test EncryptedField dataclass."""

    def test_encrypted_field_creation(self):
        """Test basic EncryptedField creation."""
        field = EncryptedField(
            algorithm="fernet",
            encrypted_data="encrypted_data_here",
            classification=DataClassification.INTERNAL,
        )

        assert field.algorithm == "fernet"
        assert field.encrypted_data == "encrypted_data_here"
        assert field.classification == DataClassification.INTERNAL
        assert isinstance(field.created_at, datetime)
        assert field.metadata == {}

    def test_encrypted_field_with_metadata(self):
        """Test EncryptedField creation with metadata."""
        metadata = {"key": "value", "source": "test"}
        field = EncryptedField(
            algorithm="base64",
            encrypted_data="data",
            classification=DataClassification.CONFIDENTIAL,
            metadata=metadata,
        )

        assert field.metadata == metadata

    def test_encrypted_field_default_timestamp(self):
        """Test that default timestamp is recent."""
        before = datetime.now(UTC)
        field = EncryptedField(
            algorithm="test", encrypted_data="data", classification=DataClassification.PUBLIC
        )
        after = datetime.now(UTC)

        assert before <= field.created_at <= after

    def test_encrypted_field_custom_timestamp(self):
        """Test EncryptedField with custom timestamp."""
        custom_time = datetime(2023, 1, 1, tzinfo=UTC)
        field = EncryptedField(
            algorithm="test",
            encrypted_data="data",
            classification=DataClassification.RESTRICTED,
            created_at=custom_time,
        )

        assert field.created_at == custom_time


@pytest.mark.unit
class TestSymmetricEncryptionService:
    """Test SymmetricEncryptionService."""

    def test_init_empty_secret_raises(self):
        """Test that empty secret raises ValueError."""
        with pytest.raises(ValueError, match="secret must be a non-empty string"):
            SymmetricEncryptionService("")

    def test_init_valid_secret(self):
        """Test initialization with valid secret."""
        service = SymmetricEncryptionService("test-secret")
        assert service._secret == b"test-secret"
        assert service._prefer_fernet is True

    def test_init_prefer_fernet_false(self):
        """Test initialization with prefer_fernet=False."""
        service = SymmetricEncryptionService("test-secret", prefer_fernet=False)
        assert service._prefer_fernet is False
        assert service._fernet is None

    @patch("dotmac.platform.secrets.encryption.Fernet")
    def test_init_with_fernet_available(self, mock_fernet_class):
        """Test initialization when Fernet is available."""
        mock_fernet_instance = Mock()
        mock_fernet_class.return_value = mock_fernet_instance

        service = SymmetricEncryptionService("test-secret")

        # Should create Fernet instance with hashed key
        expected_key_material = hashlib.sha256(b"test-secret").digest()
        expected_fernet_key = base64.urlsafe_b64encode(expected_key_material)
        mock_fernet_class.assert_called_once_with(expected_fernet_key)
        assert service._fernet == mock_fernet_instance

    @patch("dotmac.platform.secrets.encryption.Fernet")
    def test_init_fernet_creation_fails(self, mock_fernet_class):
        """Test initialization when Fernet creation fails."""
        mock_fernet_class.side_effect = Exception("Fernet creation failed")

        service = SymmetricEncryptionService("test-secret")
        assert service._fernet is None

    def test_encrypt_invalid_type_raises(self):
        """Test that encrypting non-string raises TypeError."""
        service = SymmetricEncryptionService("test-secret", prefer_fernet=False)

        with pytest.raises(TypeError, match="plaintext must be a string"):
            service.encrypt(123)  # type: ignore

    def test_encrypt_with_fernet(self):
        """Test encryption using Fernet."""
        with patch("dotmac.platform.secrets.encryption.Fernet") as mock_fernet_class:
            mock_fernet = Mock()
            mock_fernet.encrypt.return_value = b"encrypted_token"
            mock_fernet_class.return_value = mock_fernet

            service = SymmetricEncryptionService("test-secret")
            result = service.encrypt("test-plaintext", DataClassification.CONFIDENTIAL)

            assert isinstance(result, EncryptedField)
            assert result.algorithm == "fernet"
            assert result.encrypted_data == "encrypted_token"
            assert result.classification == DataClassification.CONFIDENTIAL
            assert "fingerprint" in result.metadata
            assert result.metadata["classification"] == "confidential"

    def test_encrypt_fallback_base64(self):
        """Test encryption fallback to base64."""
        service = SymmetricEncryptionService("test-secret", prefer_fernet=False)
        result = service.encrypt("test-plaintext", DataClassification.INTERNAL)

        assert isinstance(result, EncryptedField)
        assert result.algorithm == "base64"
        assert result.classification == DataClassification.INTERNAL
        assert "fingerprint" in result.metadata

        # Verify we can decode the data manually
        encrypted_bytes = base64.b64decode(result.encrypted_data)
        assert len(encrypted_bytes) > 0

    def test_encrypt_custom_algorithm_fallback(self):
        """Test encryption with custom algorithm falls back to base64."""
        service = SymmetricEncryptionService("test-secret", prefer_fernet=False)
        result = service.encrypt("test-plaintext", algorithm="custom")

        assert result.algorithm == "base64"  # Falls back

    def test_encrypt_default_classification(self):
        """Test encryption with default classification."""
        service = SymmetricEncryptionService("test-secret", prefer_fernet=False)
        result = service.encrypt("test-plaintext")

        assert result.classification == DataClassification.INTERNAL

    def test_decrypt_fernet(self):
        """Test decryption using Fernet."""
        with patch("dotmac.platform.secrets.encryption.Fernet") as mock_fernet_class:
            mock_fernet = Mock()
            mock_fernet.decrypt.return_value = b"decrypted_plaintext"
            mock_fernet_class.return_value = mock_fernet

            service = SymmetricEncryptionService("test-secret")

            field = EncryptedField(
                algorithm="fernet",
                encrypted_data="encrypted_token",
                classification=DataClassification.INTERNAL,
            )

            result = service.decrypt(field)
            assert result == "decrypted_plaintext"
            mock_fernet.decrypt.assert_called_once_with(b"encrypted_token")

    def test_decrypt_fernet_invalid_token(self):
        """Test decryption with invalid Fernet token."""
        with patch("dotmac.platform.secrets.encryption.Fernet") as mock_fernet_class:
            from dotmac.platform.secrets.encryption import FernetInvalidToken

            mock_fernet = Mock()
            mock_fernet.decrypt.side_effect = FernetInvalidToken()
            mock_fernet_class.return_value = mock_fernet

            service = SymmetricEncryptionService("test-secret")

            field = EncryptedField(
                algorithm="fernet",
                encrypted_data="invalid_token",
                classification=DataClassification.INTERNAL,
            )

            with pytest.raises(ValueError, match="invalid fernet token"):
                service.decrypt(field)

    def test_decrypt_base64(self):
        """Test decryption using base64 algorithm."""
        service = SymmetricEncryptionService("test-secret", prefer_fernet=False)

        # First encrypt to get valid base64 data
        plaintext = "test-plaintext"
        encrypted_field = service.encrypt(plaintext)

        # Then decrypt
        result = service.decrypt(encrypted_field)
        assert result == plaintext

    def test_decrypt_fallback_algorithm(self):
        """Test decryption with fallback algorithm."""
        service = SymmetricEncryptionService("test-secret", prefer_fernet=False)

        # Create a field with 'fallback' algorithm (should work like base64)
        plaintext = "test-plaintext"
        encrypted_field = service.encrypt(plaintext)
        encrypted_field.algorithm = "fallback"  # Change algorithm

        result = service.decrypt(encrypted_field)
        assert result == plaintext

    def test_decrypt_unsupported_algorithm(self):
        """Test decryption with unsupported algorithm."""
        service = SymmetricEncryptionService("test-secret")

        field = EncryptedField(
            algorithm="unknown", encrypted_data="data", classification=DataClassification.INTERNAL
        )

        with pytest.raises(ValueError, match="Unsupported algorithm 'unknown'"):
            service.decrypt(field)

    def test_xor_bytes_static_method(self):
        """Test _xor_bytes static method."""
        data = b"hello"
        key = b"key"

        result = SymmetricEncryptionService._xor_bytes(data, key)
        assert isinstance(result, bytes)
        assert len(result) == len(data)

        # Verify XOR is reversible
        restored = SymmetricEncryptionService._xor_bytes(result, key)
        assert restored == data

    def test_xor_bytes_empty_key_raises(self):
        """Test _xor_bytes with empty key raises ValueError."""
        with pytest.raises(ValueError, match="key must not be empty"):
            SymmetricEncryptionService._xor_bytes(b"data", b"")

    def test_xor_bytes_key_cycling(self):
        """Test that XOR properly cycles through key bytes."""
        data = b"hello world"  # Longer than key
        key = b"ab"

        result = SymmetricEncryptionService._xor_bytes(data, key)

        # Manually verify XOR cycling
        expected = bytes(data[i] ^ key[i % len(key)] for i in range(len(data)))
        assert result == expected

    def test_round_trip_encryption_fernet(self):
        """Test complete round-trip encryption/decryption with Fernet."""
        with patch("dotmac.platform.secrets.encryption.Fernet") as mock_fernet_class:
            mock_fernet = Mock()
            # Make encrypt/decrypt actually work for round-trip
            mock_fernet.encrypt.return_value = b"mock_encrypted"
            mock_fernet.decrypt.return_value = b"original-plaintext"
            mock_fernet_class.return_value = mock_fernet

            service = SymmetricEncryptionService("test-secret")

            original = "original-plaintext"
            encrypted = service.encrypt(original, DataClassification.RESTRICTED)
            decrypted = service.decrypt(encrypted)

            assert decrypted == original
            assert encrypted.classification == DataClassification.RESTRICTED

    def test_round_trip_encryption_base64(self):
        """Test complete round-trip encryption/decryption with base64."""
        service = SymmetricEncryptionService("test-secret", prefer_fernet=False)

        original = "Hello, World! 🌍"
        encrypted = service.encrypt(original, DataClassification.PUBLIC)
        decrypted = service.decrypt(encrypted)

        assert decrypted == original
        assert encrypted.algorithm == "base64"
        assert encrypted.classification == DataClassification.PUBLIC

    def test_multiple_round_trips(self):
        """Test multiple round-trip encryptions."""
        service = SymmetricEncryptionService("test-secret", prefer_fernet=False)

        test_strings = [
            "simple",
            "with spaces",
            "with-special-chars!@#$%",
            "unicode: café, naïve, 中文",
            "",  # empty string
            "a" * 1000,  # long string
        ]

        for original in test_strings:
            encrypted = service.encrypt(original)
            decrypted = service.decrypt(encrypted)
            assert decrypted == original, f"Failed for: {original!r}"

    def test_metadata_fingerprint_consistent(self):
        """Test that fingerprint in metadata is consistent."""
        service = SymmetricEncryptionService("test-secret", prefer_fernet=False)

        result1 = service.encrypt("test1")
        result2 = service.encrypt("test2")

        # Same service should produce same fingerprint
        assert result1.metadata["fingerprint"] == result2.metadata["fingerprint"]

        # Different service should produce different fingerprint
        service2 = SymmetricEncryptionService("different-secret", prefer_fernet=False)
        result3 = service2.encrypt("test1")

        assert result1.metadata["fingerprint"] != result3.metadata["fingerprint"]

    def test_metadata_classification_stored(self):
        """Test that classification is stored in metadata."""
        service = SymmetricEncryptionService("test-secret", prefer_fernet=False)

        for classification in DataClassification:
            result = service.encrypt("test", classification)
            assert result.metadata["classification"] == classification.value


@pytest.mark.unit
class TestEdgeCases:
    """Test edge cases and error conditions."""

    def test_encrypt_empty_string(self):
        """Test encrypting empty string."""
        service = SymmetricEncryptionService("test-secret", prefer_fernet=False)
        result = service.encrypt("")

        decrypted = service.decrypt(result)
        assert decrypted == ""

    def test_encrypt_very_long_string(self):
        """Test encrypting very long string."""
        service = SymmetricEncryptionService("test-secret", prefer_fernet=False)
        long_string = "a" * 10000

        result = service.encrypt(long_string)
        decrypted = service.decrypt(result)
        assert decrypted == long_string

    def test_different_keys_incompatible(self):
        """Test that different keys cannot decrypt each other's data."""
        service1 = SymmetricEncryptionService("key1", prefer_fernet=False)
        service2 = SymmetricEncryptionService("key2", prefer_fernet=False)

        encrypted = service1.encrypt("test-data")

        # Decrypting with different key should give different result
        decrypted = service2.decrypt(encrypted)
        assert decrypted != "test-data"

    def test_unicode_handling(self):
        """Test proper Unicode handling."""
        service = SymmetricEncryptionService("test-secret", prefer_fernet=False)

        unicode_text = "Hello 世界 🌍 café naïve résumé"
        encrypted = service.encrypt(unicode_text)
        decrypted = service.decrypt(encrypted)

        assert decrypted == unicode_text

    def test_service_immutability(self):
        """Test that service operations don't modify state."""
        service = SymmetricEncryptionService("test-secret", prefer_fernet=False)

        original_secret = service._secret
        encrypted1 = service.encrypt("test1")
        encrypted2 = service.encrypt("test2")

        # Secret should remain unchanged
        assert service._secret == original_secret

        # Multiple encryptions should work
        assert service.decrypt(encrypted1) == "test1"
        assert service.decrypt(encrypted2) == "test2"


@pytest.mark.unit
class TestModuleExports:
    """Test module exports."""

    def test_all_exports(self):
        """Test that __all__ contains expected exports."""
        from dotmac.platform.secrets import encryption

        expected_exports = {
            "DataClassification",
            "EncryptedField",
            "SymmetricEncryptionService",
        }

        assert set(encryption.__all__) == expected_exports

    def test_imports_work(self):
        """Test that all exports can be imported."""
        # This test verifies the imports at the top of this file work
        assert DataClassification is not None
        assert EncryptedField is not None
        assert SymmetricEncryptionService is not None
