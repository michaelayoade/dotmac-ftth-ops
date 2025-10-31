"""
Root pytest configuration for the DotMac test suite.

Fixture implementations are split across lightweight plugin modules to keep
this file concise and easier to navigate.
"""

pytest_plugins = [
    "tests.fixtures.environment",
    "tests.fixtures.database",
    "tests.fixtures.mocks",
    "tests.fixtures.async_support",
    "tests.fixtures.cleanup",
    "tests.fixtures.app",
    "tests.fixtures.misc",
    "tests.fixtures.billing_support",
    "tests.fixtures.async_db",
    "tests.fixtures.cache_bypass",
]
