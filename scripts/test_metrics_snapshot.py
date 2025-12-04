#!/usr/bin/env python3
"""Compute verified test-suite metrics for the DotMac backend."""

from __future__ import annotations

import ast
import json
from dataclasses import dataclass, asdict
from pathlib import Path

SRC_ROOT = Path("src/dotmac/platform")
TEST_ROOT = Path("tests")


def _line_count(path: Path) -> int:
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        return sum(1 for _ in handle)


def _count_test_functions(path: Path) -> tuple[int, int]:
    try:
        tree = ast.parse(path.read_text("utf-8", errors="ignore"))
    except SyntaxError:
        return 0, 0
    total = 0
    async_total = 0
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name.startswith("test_"):
            total += 1
            if isinstance(node, ast.AsyncFunctionDef):
                async_total += 1
    return total, async_total


def _source_modules() -> list[Path]:
    return [p for p in SRC_ROOT.iterdir() if p.is_dir() and p.name != "__pycache__"]


def _source_file_count(module: Path) -> int:
    return sum(1 for _ in module.rglob("*.py"))


@dataclass
class ModuleStats:
    module: str
    source_files: int
    test_files: int = 0
    test_functions: int = 0
    async_tests: int = 0
    test_lines: int = 0

    @property
    def ratio(self) -> float:
        if self.source_files <= 0:
            return 0.0
        return self.test_files / self.source_files


@dataclass
class Snapshot:
    summary: dict[str, object]
    modules: list[dict[str, object]]

    def to_json(self) -> str:
        return json.dumps({
            "summary": self.summary,
            "modules": self.modules,
        }, indent=2, sort_keys=True)


def collect_snapshot() -> Snapshot:
    modules = {module.name: ModuleStats(module=module.name, source_files=_source_file_count(module)) for module in _source_modules()}

    total_test_files = 0
    total_test_functions = 0
    total_async_tests = 0
    total_test_lines = 0

    for test_file in TEST_ROOT.rglob("*.py"):
        total_test_files += 1
        funcs, async_funcs = _count_test_functions(test_file)
        lines = _line_count(test_file)
        total_test_functions += funcs
        total_async_tests += async_funcs
        total_test_lines += lines

        rel = test_file.relative_to(TEST_ROOT)
        parts = rel.parts
        if len(parts) < 2:
            continue  # skip root-level helper modules for per-module stats
        module_name = parts[0]
        if module_name not in modules:
            continue  # allow helper-only test packages without source counterparts
        stats = modules[module_name]
        stats.test_files += 1
        stats.test_functions += funcs
        stats.async_tests += async_funcs
        stats.test_lines += lines

    summary = {
        "total_source_modules": len(modules),
        "total_source_files": sum(stat.source_files for stat in modules.values()),
        "total_test_files": total_test_files,
        "total_test_functions": total_test_functions,
        "total_async_tests": total_async_tests,
        "total_test_lines": total_test_lines,
        "modules_with_tests": sorted(name for name, stat in modules.items() if stat.test_files > 0),
        "modules_without_tests": sorted(name for name, stat in modules.items() if stat.test_files == 0),
    }

    module_payload = []
    for stat in sorted(modules.values(), key=lambda s: s.module):
        payload = asdict(stat)
        payload["ratio"] = stat.ratio
        module_payload.append(payload)

    return Snapshot(summary=summary, modules=module_payload)


def main() -> None:
    snapshot = collect_snapshot()
    print(snapshot.to_json())


if __name__ == "__main__":
    main()
