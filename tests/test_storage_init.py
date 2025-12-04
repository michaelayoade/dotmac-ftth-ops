"""Tests for storage initialization module."""

from unittest.mock import Mock, patch

import pytest

# Import the entire module to ensure coverage tracking
import dotmac.platform.storage_init
from dotmac.platform.storage_init import get_storage, init_storage


@pytest.mark.unit
class TestStorageInit:
    """Test storage initialization functionality."""

    @patch("dotmac.platform.storage_init.settings")
    @patch("dotmac.platform.storage_init.MinIOStorage")
    @patch("dotmac.platform.storage_init.logger")
    def test_init_storage_success(self, mock_logger, mock_minio_class, mock_settings):
        """Test successful storage initialization."""
        # Setup settings
        mock_settings.storage.endpoint = "minio.example.com"
        mock_settings.storage.access_key = "test_access_key"
        mock_settings.storage.secret_key = "test_secret_key"
        mock_settings.storage.bucket = "test-bucket"
        mock_settings.storage.use_ssl = True
        mock_settings.vault.enabled = False

        # Setup MinIO mock
        mock_storage = Mock()
        mock_minio_class.return_value = mock_storage

        result = init_storage()

        # Verify MinIO was initialized with correct parameters
        mock_minio_class.assert_called_once_with(
            endpoint="minio.example.com",
            access_key="test_access_key",
            secret_key="test_secret_key",
            bucket="test-bucket",
            secure=True,
        )

        # Verify logging
        mock_logger.info.assert_called_once()
        log_call = mock_logger.info.call_args
        assert "MinIO storage initialized" in log_call[0][0]

        assert result == mock_storage

    @patch("dotmac.platform.storage_init.settings")
    @patch("dotmac.platform.storage_init.MinIOStorage")
    @patch("dotmac.platform.storage_init.logger")
    def test_init_storage_with_vault(self, mock_logger, mock_minio_class, mock_settings):
        """Test storage initialization with Vault enabled."""
        # Setup settings with Vault
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "vault_access_key"
        mock_settings.storage.secret_key = "vault_secret_key"
        mock_settings.storage.bucket = "dotmac"
        mock_settings.storage.use_ssl = False
        mock_settings.vault.enabled = True

        mock_storage = Mock()
        mock_minio_class.return_value = mock_storage

        result = init_storage()

        # Verify storage created
        assert result == mock_storage

        # Verify logging includes vault information
        mock_logger.info.assert_called_once()
        log_call = mock_logger.info.call_args
        assert log_call[1]["using_vault"] is True

    @patch("dotmac.platform.storage_init.settings")
    @patch("dotmac.platform.storage_init.MinIOStorage")
    @patch("dotmac.platform.storage_init.logger")
    def test_init_storage_no_credentials(self, mock_logger, mock_minio_class, mock_settings):
        """Test storage initialization with no credentials."""
        # Setup settings without credentials
        mock_settings.storage.endpoint = None
        mock_settings.storage.access_key = None
        mock_settings.storage.secret_key = None
        mock_settings.storage.bucket = None
        mock_settings.storage.use_ssl = False
        mock_settings.vault.enabled = False

        mock_storage = Mock()
        mock_minio_class.return_value = mock_storage

        result = init_storage()

        # Verify storage created with defaults
        mock_minio_class.assert_called_once_with(
            endpoint=None,
            access_key=None,
            secret_key=None,
            bucket=None,
            secure=False,
        )

        # Verify logging shows defaults
        mock_logger.info.assert_called_once()
        log_call = mock_logger.info.call_args
        assert log_call[1]["endpoint"] == "localhost:9000"  # default
        assert log_call[1]["bucket"] == "dotmac"  # default
        assert log_call[1]["has_credentials"] is False

        assert result == mock_storage

    @patch("dotmac.platform.storage_init.settings")
    @patch("dotmac.platform.storage_init.MinIOStorage")
    @patch("dotmac.platform.storage_init.logger")
    def test_init_storage_exception(self, mock_logger, mock_minio_class, mock_settings):
        """Test storage initialization with exception."""
        # Setup settings
        mock_settings.storage.endpoint = "minio.example.com"
        mock_settings.storage.access_key = "test_access_key"
        mock_settings.storage.secret_key = "test_secret_key"
        mock_settings.storage.bucket = "test-bucket"
        mock_settings.storage.use_ssl = True
        mock_settings.vault.enabled = False

        # Setup MinIO to raise exception
        mock_minio_class.side_effect = Exception("Connection failed")

        with pytest.raises(Exception, match="Connection failed"):
            init_storage()

        # Verify error logging
        mock_logger.error.assert_called_once_with(
            "Failed to initialize MinIO storage", error="Connection failed"
        )

    @patch("dotmac.platform.storage_init.init_storage")
    def test_get_storage_creates_instance(self, mock_init_storage):
        """Test get_storage creates new instance if none exists."""
        # Clear any existing global storage

        dotmac.platform.storage_init._storage = None

        mock_storage = Mock()
        mock_init_storage.return_value = mock_storage

        result = get_storage()

        mock_init_storage.assert_called_once()
        assert result == mock_storage
        assert dotmac.platform.storage_init._storage == mock_storage

    def test_get_storage_returns_existing_instance(self):
        """Test get_storage returns existing instance."""
        # Set up existing global storage

        mock_existing_storage = Mock()
        dotmac.platform.storage_init._storage = mock_existing_storage

        with patch("dotmac.platform.storage_init.init_storage") as mock_init:
            result = get_storage()

            # Should not call init_storage
            mock_init.assert_not_called()
            assert result == mock_existing_storage

        # Clean up
        dotmac.platform.storage_init._storage = None

    def test_module_imports(self):
        """Test that all required imports work."""
        from dotmac.platform.storage_init import get_storage, init_storage

        assert callable(init_storage)
        assert callable(get_storage)
