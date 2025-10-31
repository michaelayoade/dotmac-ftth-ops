"""
Comprehensive tests for the main dependencies module.

Tests dependency checking, error handling, feature flags, and decorators.
"""

from unittest.mock import MagicMock, patch

import pytest

from dotmac.platform.dependencies import (
    DependencyChecker,
    DependencyError,
    require_cryptography,
    require_dependency,
    require_meilisearch,
    require_minio,
    safe_import,
)


@pytest.mark.unit
class TestDependencyError:
    """Test DependencyError exception class."""

    def test_single_package_error(self):
        """Test DependencyError with single package."""
        error = DependencyError("test_feature", "some_package")
        assert "Feature 'test_feature' requires: some_package" in str(error)
        assert "Install with: pip install some_package" in str(error)

    def test_multiple_packages_error(self):
        """Test DependencyError with multiple packages."""
        error = DependencyError("test_feature", ["package1", "package2"])
        assert "Feature 'test_feature' requires: package1, package2" in str(error)
        assert "Install with: pip install package1 package2" in str(error)

    def test_custom_install_command(self):
        """Test DependencyError with custom install command."""
        error = DependencyError("test_feature", "some_package", "poetry install --extras test")
        assert "Feature 'test_feature' requires: some_package" in str(error)
        assert "Install with: poetry install --extras test" in str(error)

    def test_multiple_packages_with_custom_install(self):
        """Test DependencyError with multiple packages and custom install command."""
        error = DependencyError("test_feature", ["pkg1", "pkg2"], "custom install command")
        assert "Feature 'test_feature' requires: pkg1, pkg2" in str(error)
        assert "Install with: custom install command" in str(error)


@pytest.mark.unit
class TestDependencyChecker:
    """Test DependencyChecker class."""

    def test_feature_dependencies_structure(self):
        """Test FEATURE_DEPENDENCIES is properly structured."""
        deps = DependencyChecker.FEATURE_DEPENDENCIES
        assert isinstance(deps, dict)

        # Check a few known features
        assert "storage_s3_enabled" in deps
        assert "search_meilisearch_enabled" in deps
        assert "encryption_fernet" in deps

        # Verify structure
        for _feature, config in deps.items():
            assert "packages" in config
            if "install_cmd" in config:
                assert isinstance(config["install_cmd"], str)

    @patch("dotmac.platform.dependencies.importlib.import_module")
    def test_check_feature_dependency_success(self, mock_import):
        """Test check_feature_dependency when all packages available."""
        mock_import.return_value = MagicMock()

        result = DependencyChecker.check_feature_dependency("storage_enabled")
        assert result is True

        mock_import.assert_called_once_with("minio")

    @patch("dotmac.platform.dependencies.importlib.import_module")
    def test_check_feature_dependency_missing(self, mock_import):
        """Test check_feature_dependency when packages missing."""
        mock_import.side_effect = ImportError("Module not found")

        result = DependencyChecker.check_feature_dependency("storage_enabled")
        assert result is False

    @patch("dotmac.platform.dependencies.importlib.import_module")
    def test_check_feature_dependency_partial_missing(self, mock_import):
        """Test check_feature_dependency when some packages missing."""
        # First package available, second missing
        mock_import.side_effect = [MagicMock(), ImportError("Module not found")]

        result = DependencyChecker.check_feature_dependency("data_transfer_excel")
        assert result is False

    def test_check_feature_dependency_unknown_feature(self):
        """Test check_feature_dependency with unknown feature."""
        result = DependencyChecker.check_feature_dependency("unknown_feature")
        assert result is True  # Should return True for unknown features

    @patch("dotmac.platform.dependencies.importlib.import_module")
    def test_require_feature_dependency_success(self, mock_import):
        """Test require_feature_dependency when packages available."""
        mock_import.return_value = MagicMock()

        # Should not raise
        DependencyChecker.require_feature_dependency("storage_enabled")

    @patch("dotmac.platform.dependencies.importlib.import_module")
    def test_require_feature_dependency_missing(self, mock_import):
        """Test require_feature_dependency when packages missing."""
        mock_import.side_effect = ImportError("Module not found")

        with pytest.raises(DependencyError) as exc_info:
            DependencyChecker.require_feature_dependency("storage_enabled")

        assert "storage_enabled" in str(exc_info.value)
        assert "minio" in str(exc_info.value)

    def test_require_feature_dependency_unknown_feature(self):
        """Test require_feature_dependency with unknown feature."""
        # Should not raise
        DependencyChecker.require_feature_dependency("unknown_feature")

    @patch("dotmac.platform.dependencies.settings")
    @patch.object(DependencyChecker, "check_feature_dependency")
    def test_check_enabled_features(self, mock_check, mock_settings):
        """Test check_enabled_features method."""
        # Mock settings to have some features enabled
        mock_settings.features.storage_enabled = True
        mock_settings.features.search_meilisearch_enabled = False
        mock_settings.features.encryption_fernet = True

        # Mock dependency checks
        mock_check.side_effect = lambda feature: feature == "storage_enabled"

        results = DependencyChecker.check_enabled_features()

        # Should only check enabled features
        assert "storage_enabled" in results
        assert "encryption_fernet" in results
        assert "search_meilisearch_enabled" not in results  # Not enabled

        # Check results
        assert results["storage_enabled"] is True
        assert results["encryption_fernet"] is False

    @patch("dotmac.platform.dependencies.settings")
    @patch.object(DependencyChecker, "require_feature_dependency")
    def test_validate_enabled_features_success(self, mock_require, mock_settings):
        """Test validate_enabled_features when all pass."""
        # Mock all features as disabled except the one we're testing
        for feature in DependencyChecker.FEATURE_DEPENDENCIES.keys():
            setattr(mock_settings.features, feature, feature == "storage_enabled")

        # Should not raise
        DependencyChecker.validate_enabled_features()

        # Should only check the enabled feature
        mock_require.assert_called_once_with("storage_enabled")

    @patch("dotmac.platform.dependencies.settings")
    @patch.object(DependencyChecker, "require_feature_dependency")
    def test_validate_enabled_features_failure(self, mock_require, mock_settings):
        """Test validate_enabled_features when dependency missing."""
        mock_settings.features.storage_enabled = True
        mock_require.side_effect = DependencyError("storage_enabled", "minio")

        with pytest.raises(DependencyError):
            DependencyChecker.validate_enabled_features()


@pytest.mark.unit
class TestRequireDependencyDecorator:
    """Test require_dependency decorator."""

    @patch("dotmac.platform.dependencies.settings")
    @patch.object(DependencyChecker, "require_feature_dependency")
    def test_decorator_feature_enabled_deps_available(self, mock_require, mock_settings):
        """Test decorator when feature enabled and dependencies available."""
        mock_settings.features.storage_enabled = True
        mock_require.return_value = None  # Success

        @require_dependency("storage_enabled")
        def test_func():
            return "success"

        result = test_func()
        assert result == "success"
        mock_require.assert_called_once_with("storage_enabled")

    @patch("dotmac.platform.dependencies.settings")
    def test_decorator_feature_disabled(self, mock_settings):
        """Test decorator when feature disabled."""
        mock_settings.features.storage_enabled = False

        @require_dependency("storage_enabled")
        def test_func():
            return "success"

        with pytest.raises(ValueError) as exc_info:
            test_func()

        assert "storage_enabled" in str(exc_info.value)
        assert "not enabled in settings" in str(exc_info.value)

    @patch("dotmac.platform.dependencies.settings")
    @patch.object(DependencyChecker, "require_feature_dependency")
    def test_decorator_deps_missing(self, mock_require, mock_settings):
        """Test decorator when dependencies missing."""
        mock_settings.features.storage_enabled = True
        mock_require.side_effect = DependencyError("storage_enabled", "minio")

        @require_dependency("storage_enabled")
        def test_func():
            return "success"

        with pytest.raises(DependencyError):
            test_func()

    @patch("dotmac.platform.dependencies.settings")
    @patch.object(DependencyChecker, "require_feature_dependency")
    def test_decorator_with_args(self, mock_require, mock_settings):
        """Test decorator preserves function args/kwargs."""
        mock_settings.features.storage_enabled = True

        @require_dependency("storage_enabled")
        def test_func(arg1, arg2, kwarg1=None):
            return f"{arg1}-{arg2}-{kwarg1}"

        result = test_func("a", "b", kwarg1="c")
        assert result == "a-b-c"


@pytest.mark.unit
class TestSafeImport:
    """Test safe_import function."""

    @patch("dotmac.platform.dependencies.importlib.import_module")
    def test_safe_import_success(self, mock_import):
        """Test safe_import when module available."""
        mock_module = MagicMock()
        mock_import.return_value = mock_module

        result = safe_import("test_module")
        assert result is mock_module

    @patch("dotmac.platform.dependencies.importlib.import_module")
    def test_safe_import_failure_no_feature(self, mock_import):
        """Test safe_import when module missing and no feature flag."""
        mock_import.side_effect = ImportError("Module not found")

        result = safe_import("test_module")
        assert result is None

    @patch("dotmac.platform.dependencies.importlib.import_module")
    @patch("dotmac.platform.dependencies.settings")
    def test_safe_import_failure_feature_disabled(self, mock_settings, mock_import):
        """Test safe_import when module missing but feature disabled."""
        mock_import.side_effect = ImportError("Module not found")
        mock_settings.features.storage_enabled = False

        result = safe_import("minio", "storage_enabled")
        assert result is None

    @patch("dotmac.platform.dependencies.importlib.import_module")
    @patch("dotmac.platform.dependencies.settings")
    @patch.object(DependencyChecker, "require_feature_dependency")
    def test_safe_import_failure_feature_enabled(self, mock_require, mock_settings, mock_import):
        """Test safe_import when module missing and feature enabled."""
        mock_import.side_effect = ImportError("Module not found")
        mock_settings.features.storage_enabled = True
        mock_require.side_effect = DependencyError("storage_enabled", "minio")

        with pytest.raises(DependencyError):
            safe_import("minio", "storage_enabled")


@pytest.mark.unit
class TestConvenienceFunctions:
    """Test convenience functions for common dependencies."""

    @patch("dotmac.platform.dependencies.settings")
    @patch.object(DependencyChecker, "require_feature_dependency")
    def test_require_minio_enabled_available(self, mock_require, mock_settings):
        """Test require_minio when storage enabled and minio available."""
        mock_settings.features.storage_enabled = True
        mock_require.return_value = None

        fake_minio = MagicMock(name="minio_module")

        with patch.dict("sys.modules", {"minio": fake_minio}):
            result = require_minio()

        assert result is fake_minio
        mock_require.assert_called_once_with("storage_enabled")

    @patch("dotmac.platform.dependencies.settings")
    def test_require_minio_disabled(self, mock_settings):
        """Test require_minio when storage disabled."""
        mock_settings.features.storage_enabled = False

        with pytest.raises(ValueError) as exc_info:
            require_minio()

        assert "Storage is not enabled" in str(exc_info.value)

    @patch("dotmac.platform.dependencies.settings")
    @patch.object(DependencyChecker, "require_feature_dependency")
    def test_require_minio_missing(self, mock_require, mock_settings):
        """Test require_minio when minio missing."""
        mock_settings.features.storage_enabled = True
        mock_require.side_effect = DependencyError("storage_enabled", "minio")

        with pytest.raises(DependencyError):
            require_minio()

    @patch("dotmac.platform.dependencies.settings")
    @patch.object(DependencyChecker, "require_feature_dependency")
    def test_require_meilisearch_enabled_available(self, mock_require, mock_settings):
        """Test require_meilisearch when search enabled and meilisearch available."""
        mock_settings.features.search_enabled = True

        with patch("builtins.__import__") as mock_import:
            mock_meilisearch = MagicMock()
            mock_import.return_value = mock_meilisearch

            result = require_meilisearch()
            assert result is mock_meilisearch
            mock_require.assert_called_once_with("search_enabled")

    @patch("dotmac.platform.dependencies.settings")
    def test_require_meilisearch_disabled(self, mock_settings):
        """Test require_meilisearch when search disabled."""
        mock_settings.features.search_enabled = False

        with pytest.raises(ValueError) as exc_info:
            require_meilisearch()

        assert "Search is not enabled" in str(exc_info.value)

    @patch("dotmac.platform.dependencies.settings")
    @patch.object(DependencyChecker, "require_feature_dependency")
    def test_require_cryptography_enabled_available(self, mock_require, mock_settings):
        """Test require_cryptography when encryption enabled and cryptography available."""
        mock_settings.features.encryption_fernet = True

        with patch("cryptography.fernet.Fernet") as mock_fernet:
            result = require_cryptography()
            assert result is mock_fernet
            mock_require.assert_called_once_with("encryption_fernet")

    @patch("dotmac.platform.dependencies.settings")
    def test_require_cryptography_disabled(self, mock_settings):
        """Test require_cryptography when encryption disabled."""
        mock_settings.features.encryption_fernet = False

        with pytest.raises(ValueError) as exc_info:
            require_cryptography()

        assert "Fernet encryption is not enabled" in str(exc_info.value)


@pytest.mark.unit
class TestFeatureDependencyIntegration:
    """Integration tests for feature dependency system."""

    @patch("dotmac.platform.dependencies.settings")
    def test_multiple_features_check(self, mock_settings):
        """Test checking multiple features at once."""
        # Mock all features as disabled except the ones we're testing
        for feature in DependencyChecker.FEATURE_DEPENDENCIES.keys():
            enabled = feature in ["storage_enabled", "encryption_fernet"]
            setattr(mock_settings.features, feature, enabled)

        with patch.object(DependencyChecker, "check_feature_dependency") as mock_check:
            mock_check.return_value = True
            results = DependencyChecker.check_enabled_features()

            # Should only check enabled features
            assert len(results) == 2
            assert "storage_enabled" in results
            assert "encryption_fernet" in results

    def test_feature_dependencies_completeness(self):
        """Test that all defined features have proper structure."""
        deps = DependencyChecker.FEATURE_DEPENDENCIES

        for feature, config in deps.items():
            # Each feature should have packages
            assert "packages" in config, f"Feature {feature} missing packages"

            packages = config["packages"]
            if isinstance(packages, str):
                assert len(packages) > 0, f"Feature {feature} has empty package string"
            elif isinstance(packages, list):
                assert len(packages) > 0, f"Feature {feature} has empty package list"
                assert all(isinstance(pkg, str) for pkg in packages), (
                    f"Feature {feature} has non-string packages"
                )
            else:
                raise AssertionError(f"Feature {feature} packages must be string or list")
