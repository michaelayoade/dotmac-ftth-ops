"""
Comprehensive tests for CLI commands.

Tests all CLI functionality including database operations, admin creation,
key generation, migrations, service checks, and data export.
"""

import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest

pytestmark = pytest.mark.integration
from click.testing import CliRunner

# Import the entire module to ensure coverage tracking
from dotmac.platform.cli import (


    check_services,
    cleanup_sessions,
    cli,
    create_admin,
    export_audit_logs,
    generate_jwt_keys,
    init_database,
    run_migrations,
)


class TestCLICommands:
    """Test CLI command functionality."""

    @pytest.fixture
    def runner(self):
        """Create CLI runner for testing."""
        return CliRunner()

    def test_cli_group_creation(self, runner):
        """Test that the CLI group is properly created."""
        result = runner.invoke(cli, ["--help"])
        assert result.exit_code == 0
        assert "DotMac Platform Services CLI" in result.output

    def test_cli_commands_exist(self, runner):
        """Test that all expected commands are available."""
        result = runner.invoke(cli, ["--help"])
        assert result.exit_code == 0

        expected_commands = [
            "init-database",
            "create-admin",
            "generate-jwt-keys",
            "run-migrations",
            "check-services",
            "cleanup-sessions",
            "export-audit-logs",
        ]

        for command in expected_commands:
            assert command in result.output


class TestInitDatabase:
    """Test database initialization command."""

    @pytest.fixture
    def runner(self):
        return CliRunner()

    @patch("dotmac.platform.cli.init_db")
    def test_init_database_success(self, mock_init_db, runner):
        """Test successful database initialization."""
        result = runner.invoke(init_database)

        assert result.exit_code == 0
        assert "Initializing database..." in result.output
        assert "Database initialized successfully!" in result.output
        mock_init_db.assert_called_once()

    @patch("dotmac.platform.cli.init_db")
    def test_init_database_failure(self, mock_init_db, runner):
        """Test database initialization failure."""
        mock_init_db.side_effect = Exception("Database connection failed")

        result = runner.invoke(init_database)

        # CLI should catch and handle the exception
        assert "Database connection failed" in str(result.exception)
        mock_init_db.assert_called_once()


class TestCreateAdmin:
    """Test admin user creation command."""

    @pytest.fixture
    def runner(self):
        return CliRunner()

    @patch("dotmac.platform.cli.get_session")
    @patch("dotmac.platform.auth.core.hash_password")
    def test_create_admin_success(self, mock_hash_password, mock_get_session, runner):
        """Test successful admin creation."""
        # Setup mocks
        mock_hash_password.return_value = "hashed_password"
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None
        mock_get_session.return_value = mock_session

        # Mock database query to return no existing user
        mock_result = Mock()
        mock_result.first.return_value = None
        mock_session.execute.return_value = mock_result

        result = runner.invoke(create_admin, input="admin@example.com\npassword123\n")

        assert result.exit_code == 0
        assert "Admin user admin@example.com created successfully!" in result.output
        mock_hash_password.assert_called_once_with("password123")

    @patch("dotmac.platform.cli.get_session")
    @patch("dotmac.platform.auth.core.hash_password")
    def test_create_admin_user_exists(self, mock_hash_password, mock_get_session, runner):
        """Test admin creation when user already exists."""
        # Setup mocks
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None
        mock_get_session.return_value = mock_session

        # Mock database query to return existing user
        mock_result = Mock()
        mock_existing = Mock()
        mock_result.first.return_value = mock_existing
        mock_session.execute.return_value = mock_result

        result = runner.invoke(create_admin, input="admin@example.com\npassword123\n")

        assert result.exit_code == 0
        assert "User with email admin@example.com already exists!" in result.output

    @patch("dotmac.platform.cli.get_session")
    def test_create_admin_database_error(self, mock_get_session, runner):
        """Test admin creation with database error."""
        mock_get_session.side_effect = Exception("Database error")

        result = runner.invoke(create_admin, input="admin@example.com\npassword123\n")

        assert result.exit_code != 0
        assert "Database error" in str(result.exception)


class TestGenerateJWTKeys:
    """Test JWT key generation command."""

    @pytest.fixture
    def runner(self):
        return CliRunner()

    def test_generate_jwt_keys_success(self, runner):
        """Test successful JWT key generation."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            with runner.isolated_filesystem(temp_dir=tmp_dir):
                result = runner.invoke(generate_jwt_keys)

                assert result.exit_code == 0
                assert "Generating RSA key pair for JWT signing..." in result.output
                assert "Keys saved to jwt_private.pem and jwt_public.pem" in result.output

                # Check that key files were created
                assert Path("jwt_private.pem").exists()
                assert Path("jwt_public.pem").exists()

                # Check that keys contain expected content
                private_key_content = Path("jwt_private.pem").read_text()
                public_key_content = Path("jwt_public.pem").read_text()

                assert "-----BEGIN PRIVATE KEY-----" in private_key_content
                assert "-----END PRIVATE KEY-----" in private_key_content
                assert "-----BEGIN PUBLIC KEY-----" in public_key_content
                assert "-----END PUBLIC KEY-----" in public_key_content

    @patch("dotmac.platform.cli.Path")
    def test_generate_jwt_keys_file_error(self, mock_path, runner):
        """Test JWT key generation with file write error."""
        mock_path.return_value.write_bytes.side_effect = PermissionError("Cannot write file")

        result = runner.invoke(generate_jwt_keys)

        assert result.exit_code != 0
        assert "Cannot write file" in str(result.exception)


class TestRunMigrations:
    """Test database migrations command."""

    @pytest.fixture
    def runner(self):
        return CliRunner()

    @patch("subprocess.run")
    def test_run_migrations_success(self, mock_run, runner):
        """Test successful migration execution."""
        mock_run.return_value = Mock(
            returncode=0, stdout="Migration completed successfully", stderr=""
        )

        result = runner.invoke(run_migrations)

        assert result.exit_code == 0
        assert "Running database migrations..." in result.output
        assert "Migrations completed successfully!" in result.output
        assert "Migration completed successfully" in result.output

        mock_run.assert_called_once_with(
            ["alembic", "upgrade", "head"], capture_output=True, text=True
        )

    @patch("subprocess.run")
    def test_run_migrations_failure(self, mock_run, runner):
        """Test migration execution failure."""
        mock_run.return_value = Mock(
            returncode=1, stdout="", stderr="Migration failed: table already exists"
        )

        result = runner.invoke(run_migrations)

        assert result.exit_code == 1
        assert "Running database migrations..." in result.output
        assert "Migration failed!" in result.output
        assert "Migration failed: table already exists" in result.output


class TestCheckServices:
    """Test service connectivity check command."""

    @pytest.fixture
    def runner(self):
        return CliRunner()

    @patch("dotmac.platform.cli.get_session")
    @patch("dotmac.platform.core.caching.redis_client")
    @patch("httpx.AsyncClient")
    def test_check_services_all_up(self, mock_http_client, mock_redis, mock_get_session, runner):
        """Test service check when all services are up."""
        # Mock database
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None
        mock_get_session.return_value = mock_session

        # Mock Redis
        mock_redis.ping.return_value = True

        # Mock Vault HTTP response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_client_instance = AsyncMock()
        mock_client_instance.__aenter__.return_value = mock_client_instance
        mock_client_instance.__aexit__.return_value = None
        mock_client_instance.get.return_value = mock_response
        mock_http_client.return_value = mock_client_instance

        result = runner.invoke(check_services)

        assert result.exit_code == 0
        assert "Service Status:" in result.output
        assert "database" in result.output
        assert "redis" in result.output
        assert "vault" in result.output

    @patch("dotmac.platform.cli.get_session")
    def test_check_services_database_down(self, mock_get_session, runner):
        """Test service check when database is down."""
        mock_get_session.side_effect = Exception("Connection refused")

        result = runner.invoke(check_services)

        assert result.exit_code == 0  # Should still complete
        assert "✗ Failed: Connection refused" in result.output

    @patch("dotmac.platform.cli.get_session")
    @patch("dotmac.platform.core.caching.redis_client", None)  # Redis not configured
    def test_check_services_redis_not_configured(self, mock_get_session, runner):
        """Test service check when Redis is not configured."""
        # Mock database success
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None
        mock_get_session.return_value = mock_session

        result = runner.invoke(check_services)

        assert result.exit_code == 0
        assert "redis" in result.output

    def test_check_services_test_mode(self, runner):
        """Test service check in test mode."""
        result = runner.invoke(check_services, ["--test"])

        # Should run without errors even if services are down
        assert result.exit_code == 0
        assert "Service Status:" in result.output


class TestCleanupSessions:
    """Test session cleanup command."""

    @pytest.fixture
    def runner(self):
        return CliRunner()

    @patch("dotmac.platform.cli.get_session")
    def test_cleanup_sessions_default_days(self, mock_get_session, runner):
        """Test session cleanup with default retention period."""
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None
        mock_get_session.return_value = mock_session

        result = runner.invoke(cleanup_sessions)

        assert result.exit_code == 0
        assert "Deleted expired sessions" in result.output

        # Check that execute was called with correct SQL
        mock_session.execute.assert_called_once()
        call_args = mock_session.execute.call_args
        assert "DELETE FROM auth.sessions" in call_args[0][0].text
        assert "created_at < :cutoff" in call_args[0][0].text

    @patch("dotmac.platform.cli.get_session")
    def test_cleanup_sessions_custom_days(self, mock_get_session, runner):
        """Test session cleanup with custom retention period."""
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None
        mock_get_session.return_value = mock_session

        result = runner.invoke(cleanup_sessions, ["--days", "7"])

        assert result.exit_code == 0
        assert "Deleted expired sessions" in result.output

    @patch("dotmac.platform.cli.get_session")
    def test_cleanup_sessions_database_error(self, mock_get_session, runner):
        """Test session cleanup with database error."""
        mock_get_session.side_effect = Exception("Database connection failed")

        result = runner.invoke(cleanup_sessions)

        assert result.exit_code != 0
        assert "Database connection failed" in str(result.exception)


class TestExportAuditLogs:
    """Test audit log export command."""

    @pytest.fixture
    def runner(self):
        return CliRunner()

    @patch("dotmac.platform.cli.get_session")
    def test_export_audit_logs_json(self, mock_get_session, runner):
        """Test audit log export in JSON format."""
        # Mock database response
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None
        mock_get_session.return_value = mock_session

        # Create simple mock log data

        mock_log_1 = MagicMock()
        mock_log_1.__getitem__ = lambda self, key: {
            "id": 1,
            "user_id": "user1",
            "action": "login",
            "timestamp": "2023-01-01",
        }[key]
        mock_log_1.keys = lambda: ["id", "user_id", "action", "timestamp"]

        mock_log_2 = MagicMock()
        mock_log_2.__getitem__ = lambda self, key: {
            "id": 2,
            "user_id": "user2",
            "action": "logout",
            "timestamp": "2023-01-02",
        }[key]
        mock_log_2.keys = lambda: ["id", "user_id", "action", "timestamp"]

        mock_result = Mock()
        mock_result.fetchall.return_value = [mock_log_1, mock_log_2]
        mock_session.execute.return_value = mock_result

        with tempfile.TemporaryDirectory() as tmp_dir:
            with runner.isolated_filesystem(temp_dir=tmp_dir):
                result = runner.invoke(export_audit_logs, ["--format", "json"])

                assert result.exit_code == 0
                assert "Exported 2 logs to audit_logs.json" in result.output

                # Check that JSON file was created with correct content
                assert Path("audit_logs.json").exists()
                content = json.loads(Path("audit_logs.json").read_text())
                assert len(content) == 2
                assert content[0]["action"] == "login"
                assert content[1]["action"] == "logout"

    @patch("dotmac.platform.cli.get_session")
    def test_export_audit_logs_csv(self, mock_get_session, runner):
        """Test audit log export in CSV format."""
        # Mock database response
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None
        mock_get_session.return_value = mock_session

        # Create simple mock log data

        mock_log = MagicMock()
        mock_log.__getitem__ = lambda self, key: {"id": 1, "user_id": "user1", "action": "login"}[
            key
        ]
        mock_log.keys = lambda: ["id", "user_id", "action"]

        mock_result = Mock()
        mock_result.fetchall.return_value = [mock_log]
        mock_session.execute.return_value = mock_result

        with tempfile.TemporaryDirectory() as tmp_dir:
            with runner.isolated_filesystem(temp_dir=tmp_dir):
                result = runner.invoke(export_audit_logs, ["--format", "csv"])

                assert result.exit_code == 0
                assert "Exported 1 logs to audit_logs.csv" in result.output

                # Check that CSV file was created
                assert Path("audit_logs.csv").exists()

    @patch("dotmac.platform.cli.get_session")
    def test_export_audit_logs_empty(self, mock_get_session, runner):
        """Test audit log export with no logs."""
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None
        mock_get_session.return_value = mock_session
        mock_result = Mock()
        mock_result.fetchall.return_value = []
        mock_session.execute.return_value = mock_result

        with tempfile.TemporaryDirectory() as tmp_dir:
            with runner.isolated_filesystem(temp_dir=tmp_dir):
                result = runner.invoke(export_audit_logs, ["--format", "json"])

                assert result.exit_code == 0
                assert "Exported 0 logs to audit_logs.json" in result.output

    @patch("dotmac.platform.cli.get_session")
    def test_export_audit_logs_database_error(self, mock_get_session, runner):
        """Test audit log export with database error."""
        mock_get_session.side_effect = Exception("Query failed")

        result = runner.invoke(export_audit_logs)

        assert result.exit_code != 0
        assert "Query failed" in str(result.exception)


class TestCLIIntegration:
    """Test CLI integration scenarios."""

    @pytest.fixture
    def runner(self):
        return CliRunner()

    def test_cli_help_all_commands(self, runner):
        """Test that help works for all commands."""
        commands = [
            "init-database",
            "create-admin",
            "generate-jwt-keys",
            "run-migrations",
            "check-services",
            "cleanup-sessions",
            "export-audit-logs",
        ]

        for command in commands:
            result = runner.invoke(cli, [command, "--help"])
            assert result.exit_code == 0
            assert "Usage:" in result.output

    def test_cli_invalid_command(self, runner):
        """Test CLI with invalid command."""
        result = runner.invoke(cli, ["invalid-command"])
        assert result.exit_code != 0
        assert "No such command" in result.output

    @patch("dotmac.platform.cli.init_db")
    def test_multiple_command_execution(self, mock_init_db, runner):
        """Test that CLI can execute multiple commands."""
        # Test init-database
        result1 = runner.invoke(init_database)
        assert result1.exit_code == 0

        # Test generate-jwt-keys
        with tempfile.TemporaryDirectory() as tmp_dir:
            with runner.isolated_filesystem(temp_dir=tmp_dir):
                result2 = runner.invoke(generate_jwt_keys)
                assert result2.exit_code == 0


class TestCLIErrorHandling:
    """Test CLI error handling and edge cases."""

    @pytest.fixture
    def runner(self):
        return CliRunner()

    def test_cli_keyboard_interrupt(self, runner):
        """Test CLI handling of keyboard interrupt."""
        with patch("dotmac.platform.cli.init_db", side_effect=KeyboardInterrupt):
            result = runner.invoke(init_database)
            assert result.exit_code != 0

    def test_cli_unexpected_error(self, runner):
        """Test CLI handling of unexpected errors."""
        with patch("dotmac.platform.cli.init_db", side_effect=RuntimeError("Unexpected error")):
            result = runner.invoke(init_database)
            assert result.exit_code != 0
            assert "Unexpected error" in str(result.exception)

    @patch("dotmac.platform.cli.get_session")
    def test_async_command_error(self, mock_get_session, runner):
        """Test error handling in async commands."""
        # Mock the session to raise an exception during the async operation
        mock_get_session.side_effect = Exception("Database connection failed")

        result = runner.invoke(check_services)
        # The command should still complete successfully but show the error in output
        assert result.exit_code == 0  # CLI should handle errors gracefully
        assert "Database connection failed" in result.output or "Failed:" in result.output
