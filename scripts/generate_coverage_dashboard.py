#!/usr/bin/env python3
"""
Test Coverage Dashboard Generator

Creates an interactive HTML dashboard showing test coverage metrics.

Usage:
    # Generate dashboard from coverage.json
    python scripts/generate_coverage_dashboard.py

    # Specify custom input/output
    python scripts/generate_coverage_dashboard.py \\
        --input coverage.json \\
        --output dashboard.html

Features:
- Visual coverage metrics
- Module-by-module breakdown
- Uncovered line highlighting
- Historical trends (if available)
- Test quality score
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


class CoverageDashboard:
    """Generates HTML dashboard from coverage data."""

    def __init__(self, coverage_data: dict[str, Any]):
        self.data = coverage_data
        self.totals = coverage_data.get("totals", {})
        self.files = coverage_data.get("files", {})

    def generate_html(self) -> str:
        """Generate complete HTML dashboard."""
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Coverage Dashboard</title>
    {self._generate_styles()}
</head>
<body>
    <div class="container">
        {self._generate_header()}
        {self._generate_summary()}
        {self._generate_modules()}
        {self._generate_footer()}
    </div>
    {self._generate_scripts()}
</body>
</html>"""

    def _generate_styles(self) -> str:
        """Generate CSS styles."""
        return """<style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
        }

        .header h1 {
            font-size: 32px;
            margin-bottom: 10px;
        }

        .header .timestamp {
            opacity: 0.9;
            font-size: 14px;
        }

        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f9f9f9;
        }

        .metric {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .metric-value {
            font-size: 36px;
            font-weight: bold;
            margin: 10px 0;
        }

        .metric-label {
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .coverage-good { color: #10b981; }
        .coverage-warning { color: #f59e0b; }
        .coverage-bad { color: #ef4444; }

        .modules {
            padding: 30px;
        }

        .modules h2 {
            margin-bottom: 20px;
        }

        .module {
            border: 1px solid #e5e5e5;
            border-radius: 4px;
            margin-bottom: 10px;
            overflow: hidden;
        }

        .module-header {
            padding: 15px;
            background: #fafafa;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .module-header:hover {
            background: #f0f0f0;
        }

        .module-name {
            font-weight: 500;
            font-family: monospace;
        }

        .module-coverage {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .coverage-bar {
            width: 100px;
            height: 8px;
            background: #e5e5e5;
            border-radius: 4px;
            overflow: hidden;
        }

        .coverage-fill {
            height: 100%;
            transition: width 0.3s ease;
        }

        .coverage-percent {
            font-weight: 600;
            min-width: 45px;
            text-align: right;
        }

        .footer {
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #e5e5e5;
        }

        .quality-score {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 18px;
        }

        .score-excellent {
            background: #d1fae5;
            color: #065f46;
        }

        .score-good {
            background: #dbeafe;
            color: #1e40af;
        }

        .score-fair {
            background: #fef3c7;
            color: #92400e;
        }

        .score-poor {
            background: #fee2e2;
            color: #991b1b;
        }
    </style>"""

    def _generate_header(self) -> str:
        """Generate dashboard header."""
        return f"""<div class="header">
        <h1>🧪 Test Coverage Dashboard</h1>
        <div class="timestamp">Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
    </div>"""

    def _generate_summary(self) -> str:
        """Generate summary metrics."""
        coverage_percent = self.totals.get("percent_covered", 0)
        num_statements = self.totals.get("num_statements", 0)
        covered_lines = self.totals.get("covered_lines", 0)
        missing_lines = self.totals.get("missing_lines", 0)

        coverage_class = self._get_coverage_class(coverage_percent)
        quality_score, quality_class = self._calculate_quality_score()

        return f"""<div class="summary">
        <div class="metric">
            <div class="metric-label">Test Coverage</div>
            <div class="metric-value {coverage_class}">{coverage_percent:.1f}%</div>
            <div class="quality-score {quality_class}">{quality_score}</div>
        </div>

        <div class="metric">
            <div class="metric-label">Total Lines</div>
            <div class="metric-value">{num_statements:,}</div>
        </div>

        <div class="metric">
            <div class="metric-label">Covered Lines</div>
            <div class="metric-value coverage-good">{covered_lines:,}</div>
        </div>

        <div class="metric">
            <div class="metric-label">Missing Lines</div>
            <div class="metric-value coverage-bad">{missing_lines:,}</div>
        </div>
    </div>"""

    def _generate_modules(self) -> str:
        """Generate module breakdown."""
        html = ['<div class="modules">', '    <h2>Module Coverage</h2>']

        # Sort modules by coverage (lowest first)
        sorted_files = sorted(
            self.files.items(),
            key=lambda x: x[1]["summary"]["percent_covered"]
        )

        for file_path, file_data in sorted_files:
            summary = file_data.get("summary", {})
            percent = summary.get("percent_covered", 0)
            coverage_class = self._get_coverage_class(percent)
            fill_class = coverage_class.replace("coverage-", "")

            html.append(f'''    <div class="module">
        <div class="module-header">
            <div class="module-name">{file_path}</div>
            <div class="module-coverage">
                <div class="coverage-bar">
                    <div class="coverage-fill coverage-{fill_class}"
                         style="width: {percent}%; background: {'#10b981' if percent >= 80 else '#f59e0b' if percent >= 60 else '#ef4444'};"></div>
                </div>
                <div class="coverage-percent {coverage_class}">{percent:.1f}%</div>
            </div>
        </div>
    </div>''')

        html.append('</div>')
        return '\n'.join(html)

    def _generate_footer(self) -> str:
        """Generate dashboard footer."""
        return """<div class="footer">
        Generated by Test Coverage Dashboard | dotmac-ftth-ops
    </div>"""

    def _generate_scripts(self) -> str:
        """Generate JavaScript for interactivity."""
        return """<script>
        // Add any interactive features here
        console.log('Coverage dashboard loaded');
    </script>"""

    def _get_coverage_class(self, percent: float) -> str:
        """Get CSS class based on coverage percentage."""
        if percent >= 80:
            return "coverage-good"
        elif percent >= 60:
            return "coverage-warning"
        else:
            return "coverage-bad"

    def _calculate_quality_score(self) -> tuple[str, str]:
        """Calculate overall quality score."""
        coverage = self.totals.get("percent_covered", 0)

        if coverage >= 90:
            return "Excellent", "score-excellent"
        elif coverage >= 75:
            return "Good", "score-good"
        elif coverage >= 60:
            return "Fair", "score-fair"
        else:
            return "Needs Work", "score-poor"


def load_coverage_data(path: Path) -> dict[str, Any]:
    """Load coverage data from JSON file."""
    if not path.exists():
        print(f"❌ Coverage file not found: {path}")
        print("   Run: pytest --cov=src --cov-report=json")
        sys.exit(1)

    try:
        with open(path) as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Error loading coverage data: {e}")
        sys.exit(1)


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description="Generate test coverage dashboard")

    parser.add_argument(
        "--input",
        type=Path,
        default=Path("coverage.json"),
        help="Coverage JSON file (default: coverage.json)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("coverage-dashboard.html"),
        help="Output HTML file (default: coverage-dashboard.html)",
    )

    args = parser.parse_args()

    print(f"📊 Loading coverage data from {args.input}...")
    coverage_data = load_coverage_data(args.input)

    print(f"🎨 Generating dashboard...")
    dashboard = CoverageDashboard(coverage_data)
    html = dashboard.generate_html()

    print(f"💾 Writing to {args.output}...")
    args.output.write_text(html)

    coverage_percent = coverage_data.get("totals", {}).get("percent_covered", 0)
    print(f"\n✅ Dashboard generated successfully!")
    print(f"   Coverage: {coverage_percent:.1f}%")
    print(f"   Open: file://{args.output.absolute()}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
