#!/usr/bin/env python3
"""
Security Audit Script for DotMac Platform Services.

Performs automated security checks for production deployments.
"""

import argparse
import os
import sys
from datetime import UTC, datetime
from typing import Any

import structlog

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

logger = structlog.get_logger(__name__)


class SecurityAudit:
    """Security audit checker."""

    def __init__(self, environment: str = "production"):
        self.environment = environment
        self.issues: list[dict[str, Any]] = []
        self.warnings: list[dict[str, Any]] = []
        self.passed: list[dict[str, Any]] = []

    def add_issue(self, category: str, message: str, severity: str = "high") -> None:
        """Add a security issue."""
        self.issues.append(
            {
                "category": category,
                "message": message,
                "severity": severity,
                "timestamp": datetime.now(UTC).isoformat(),
            }
        )

    def add_warning(self, category: str, message: str) -> None:
        """Add a security warning."""
        self.warnings.append(
            {"category": category, "message": message, "timestamp": datetime.now(UTC).isoformat()}
        )

    def add_pass(self, category: str, message: str) -> None:
        """Add a passing check."""
        self.passed.append(
            {"category": category, "message": message, "timestamp": datetime.now(UTC).isoformat()}
        )

    def check_environment_variables(self) -> None:
        """Check critical environment variables."""
        print("\n[1/8] Checking Environment Variables...")

        # Check SECRET_KEY
        secret_key = os.getenv("SECRET_KEY")
        if not secret_key:
            self.add_issue("credentials", "SECRET_KEY not set in environment", severity="critical")
        elif secret_key == "change-me-in-production":
            self.add_issue("credentials", "SECRET_KEY uses default value", severity="critical")
        elif len(secret_key) < 32:
            self.add_issue(
                "credentials", "SECRET_KEY is too short (< 32 characters)", severity="high"
            )
        else:
            self.add_pass("credentials", "SECRET_KEY properly configured")

        # Check DATABASE_URL
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            self.add_warning("database", "DATABASE_URL not set (may be using Vault)")
        elif "password" in db_url and "change-me" in db_url.lower():
            self.add_issue("database", "DATABASE_URL contains default password", severity="high")
        else:
            self.add_pass("database", "DATABASE_URL configured")

        # Check SMTP credentials
        smtp_password = os.getenv("SMTP_PASSWORD")
        if not smtp_password:
            self.add_warning("email", "SMTP_PASSWORD not set in environment")
        else:
            self.add_pass("email", "SMTP credentials configured")

        # Check Redis
        redis_url = os.getenv("REDIS_URL") or os.getenv("REDIS_CACHE_URL")
        if not redis_url:
            self.add_warning("cache", "Redis not configured (rate limiting will use memory)")
        else:
            self.add_pass("cache", "Redis configured for caching and rate limiting")

    def check_rate_limiting(self) -> None:
        """Check rate limiting configuration."""
        print("[2/8] Checking Rate Limiting Configuration...")

        rate_limit_storage = os.getenv("RATE_LIMIT_STORAGE_URL")
        redis_url = os.getenv("REDIS_URL")

        if not rate_limit_storage and not redis_url:
            self.add_issue(
                "rate_limiting",
                "No Redis backend for rate limiting (using memory - NOT production-safe)",
                severity="high",
            )
        else:
            self.add_pass("rate_limiting", "Rate limiting backend configured")

        # Check if rate limiting is enabled
        rate_limit_enabled = os.getenv("RATE_LIMIT_ENABLED", "true").lower()
        if rate_limit_enabled == "false":
            self.add_issue("rate_limiting", "Rate limiting is DISABLED", severity="critical")
        else:
            self.add_pass("rate_limiting", "Rate limiting enabled")

    def check_cors_configuration(self) -> None:
        """Check CORS configuration."""
        print("[3/8] Checking CORS Configuration...")

        allowed_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")

        if "*" in allowed_origins:
            self.add_issue(
                "network",
                "CORS allows all origins (*) - potential security risk",
                severity="high",
            )
        elif not allowed_origins:
            self.add_warning("network", "CORS_ALLOWED_ORIGINS not explicitly set")
        else:
            self.add_pass("network", f"CORS restricted to specific origins: {allowed_origins}")

    def check_trusted_hosts(self) -> None:
        """Check trusted hosts configuration."""
        print("[4/8] Checking Trusted Hosts...")

        trusted_hosts = os.getenv("TRUSTED_HOSTS", "")

        if self.environment == "production" and not trusted_hosts:
            self.add_issue(
                "network",
                "TRUSTED_HOSTS not set in production environment",
                severity="high",
            )
        elif trusted_hosts:
            self.add_pass("network", f"Trusted hosts configured: {trusted_hosts}")
        else:
            self.add_warning("network", "TRUSTED_HOSTS not set (acceptable for development)")

    def check_tls_configuration(self) -> None:
        """Check TLS/HTTPS configuration."""
        print("[5/8] Checking TLS Configuration...")

        # Check if HTTPS redirect is enabled
        https_redirect = os.getenv(
            "HTTPS_REDIRECT", "true" if self.environment == "production" else "false"
        )

        if self.environment == "production" and https_redirect.lower() == "false":
            self.add_issue(
                "network",
                "HTTPS redirect disabled in production",
                severity="high",
            )
        elif self.environment == "production":
            self.add_pass("network", "HTTPS redirect enabled for production")

        # Check database SSL
        db_ssl_mode = os.getenv("DATABASE_SSL_MODE", "prefer")
        if self.environment == "production" and db_ssl_mode not in ["require", "verify-full"]:
            self.add_issue(
                "database",
                f"Database SSL mode '{db_ssl_mode}' not secure enough for production",
                severity="medium",
            )
        else:
            self.add_pass("database", f"Database SSL mode: {db_ssl_mode}")

    def check_jwt_configuration(self) -> None:
        """Check JWT token configuration."""
        print("[6/8] Checking JWT Configuration...")

        # Check JWT algorithm
        jwt_algorithm = os.getenv("JWT_ALGORITHM", "HS256")
        if jwt_algorithm == "HS256":
            self.add_warning(
                "auth",
                "JWT using HS256 (symmetric) - consider RS256 (asymmetric) for production",
            )
        else:
            self.add_pass("auth", f"JWT algorithm: {jwt_algorithm}")

        # Check JWT expiration
        jwt_expiration = os.getenv("JWT_ACCESS_TOKEN_EXPIRE", "15")
        try:
            expiration_minutes = int(jwt_expiration)
            if expiration_minutes > 60:
                self.add_warning(
                    "auth",
                    f"JWT access token expiration too long: {expiration_minutes} minutes",
                )
            else:
                self.add_pass("auth", f"JWT access token expiration: {expiration_minutes} minutes")
        except ValueError:
            self.add_issue("auth", "Invalid JWT_ACCESS_TOKEN_EXPIRE value", severity="medium")

    def check_webhook_security(self) -> None:
        """Check webhook security configuration."""
        print("[7/8] Checking Webhook Security...")

        # Check if webhook signature verification is enabled
        webhook_verify_sig = os.getenv("WEBHOOK_VERIFY_SIGNATURES", "true").lower()

        if webhook_verify_sig == "false":
            self.add_issue(
                "webhooks",
                "Webhook signature verification DISABLED",
                severity="high",
            )
        else:
            self.add_pass("webhooks", "Webhook signature verification enabled")

        # Check webhook HTTPS requirement
        webhook_require_https = os.getenv("WEBHOOK_REQUIRE_HTTPS", "true").lower()

        if self.environment == "production" and webhook_require_https == "false":
            self.add_issue(
                "webhooks",
                "Webhook HTTPS requirement disabled in production",
                severity="high",
            )
        else:
            self.add_pass("webhooks", "Webhook HTTPS requirement enabled")

    def check_logging_configuration(self) -> None:
        """Check logging and monitoring configuration."""
        print("[8/8] Checking Logging & Monitoring...")

        # Check log level
        log_level = os.getenv("LOG_LEVEL", "INFO")

        if log_level == "DEBUG" and self.environment == "production":
            self.add_warning(
                "monitoring",
                "DEBUG logging enabled in production (may expose sensitive data)",
            )
        else:
            self.add_pass("monitoring", f"Log level: {log_level}")

        # Check structured logging
        log_format = os.getenv("LOG_FORMAT", "json")
        if log_format != "json":
            self.add_warning(
                "monitoring",
                "Non-JSON log format may not be optimal for log aggregation",
            )
        else:
            self.add_pass("monitoring", "Structured JSON logging enabled")

    def run_audit(self) -> int:
        """Run complete security audit."""
        print(f"\n{'=' * 60}")
        print("DotMac Platform Security Audit")
        print(f"Environment: {self.environment.upper()}")
        print(f"Timestamp: {datetime.now(UTC).isoformat()}")
        print(f"{'=' * 60}")

        # Run all checks
        self.check_environment_variables()
        self.check_rate_limiting()
        self.check_cors_configuration()
        self.check_trusted_hosts()
        self.check_tls_configuration()
        self.check_jwt_configuration()
        self.check_webhook_security()
        self.check_logging_configuration()

        # Print results
        self.print_results()

        # Return exit code
        if self.issues:
            return 1  # Failure
        return 0  # Success

    def print_results(self) -> None:
        """Print audit results."""
        print(f"\n{'=' * 60}")
        print("AUDIT RESULTS")
        print(f"{'=' * 60}\n")

        # Critical issues
        critical_issues = [i for i in self.issues if i["severity"] == "critical"]
        if critical_issues:
            print(f"🔴 CRITICAL ISSUES ({len(critical_issues)}):")
            for issue in critical_issues:
                print(f"   [{issue['category']}] {issue['message']}")
            print()

        # High severity issues
        high_issues = [i for i in self.issues if i["severity"] == "high"]
        if high_issues:
            print(f"🟠 HIGH SEVERITY ISSUES ({len(high_issues)}):")
            for issue in high_issues:
                print(f"   [{issue['category']}] {issue['message']}")
            print()

        # Medium severity issues
        medium_issues = [i for i in self.issues if i["severity"] == "medium"]
        if medium_issues:
            print(f"🟡 MEDIUM SEVERITY ISSUES ({len(medium_issues)}):")
            for issue in medium_issues:
                print(f"   [{issue['category']}] {issue['message']}")
            print()

        # Warnings
        if self.warnings:
            print(f"⚠️  WARNINGS ({len(self.warnings)}):")
            for warning in self.warnings:
                print(f"   [{warning['category']}] {warning['message']}")
            print()

        # Passed checks
        if self.passed:
            print(f"✅ PASSED CHECKS ({len(self.passed)}):")
            for check in self.passed:
                print(f"   [{check['category']}] {check['message']}")
            print()

        # Summary
        print(f"{'=' * 60}")
        print("SUMMARY:")
        print(f"  Critical Issues: {len(critical_issues)}")
        print(f"  High Issues: {len(high_issues)}")
        print(f"  Medium Issues: {len(medium_issues)}")
        print(f"  Warnings: {len(self.warnings)}")
        print(f"  Passed: {len(self.passed)}")
        print(f"{'=' * 60}\n")

        if critical_issues or high_issues:
            print("❌ AUDIT FAILED - Critical or high severity issues found")
            print("   Review and fix issues before deploying to production.\n")
        elif medium_issues or self.warnings:
            print("⚠️  AUDIT PASSED WITH WARNINGS")
            print("   Consider addressing warnings for improved security.\n")
        else:
            print("✅ AUDIT PASSED - No security issues found\n")


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="DotMac Platform Security Audit")
    parser.add_argument(
        "--environment",
        "-e",
        default="production",
        choices=["development", "staging", "production"],
        help="Environment to audit (default: production)",
    )
    parser.add_argument(
        "--production",
        action="store_true",
        help="Shortcut for --environment production",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results in JSON format",
    )

    args = parser.parse_args()

    environment = "production" if args.production else args.environment

    # Run audit
    audit = SecurityAudit(environment=environment)
    exit_code = audit.run_audit()

    # JSON output if requested
    if args.json:
        import json

        results = {
            "environment": environment,
            "timestamp": datetime.now(UTC).isoformat(),
            "issues": audit.issues,
            "warnings": audit.warnings,
            "passed": audit.passed,
            "summary": {
                "critical_issues": len([i for i in audit.issues if i["severity"] == "critical"]),
                "high_issues": len([i for i in audit.issues if i["severity"] == "high"]),
                "medium_issues": len([i for i in audit.issues if i["severity"] == "medium"]),
                "warnings": len(audit.warnings),
                "passed": len(audit.passed),
            },
        }
        print(json.dumps(results, indent=2))

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
