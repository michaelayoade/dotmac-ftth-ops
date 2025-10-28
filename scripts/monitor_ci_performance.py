#!/usr/bin/env python3
"""
Monitor CI pipeline performance and suggest optimizations.

Usage:
    # Analyze recent workflow runs
    python scripts/monitor_ci_performance.py

    # Save report
    python scripts/monitor_ci_performance.py --output ci_report.md
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime
from typing import Dict, List


def run_command(cmd: List[str]) -> str:
    """Run shell command and return output."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {' '.join(cmd)}")
        print(f"Error: {e.stderr}")
        return ""


def get_recent_workflow_runs(limit: int = 10) -> List[Dict]:
    """Get recent CI workflow runs using GitHub CLI."""
    output = run_command([
        "gh", "run", "list",
        "--workflow=unified-ci.yml",
        "--limit", str(limit),
        "--json", "databaseId,conclusion,status,createdAt,updatedAt,displayTitle"
    ])

    if not output:
        return []

    try:
        return json.loads(output)
    except json.JSONDecodeError:
        print("Error parsing GitHub CLI output")
        return []


def get_job_details(run_id: str) -> List[Dict]:
    """Get job details for a specific workflow run."""
    output = run_command([
        "gh", "run", "view", run_id,
        "--json", "jobs"
    ])

    if not output:
        return []

    try:
        data = json.loads(output)
        return data.get("jobs", [])
    except json.JSONDecodeError:
        return []


def analyze_workflow_performance():
    """Analyze CI workflow performance."""
    print("🔍 Analyzing CI Workflow Performance...")
    print("=" * 80)

    runs = get_recent_workflow_runs(limit=5)

    if not runs:
        print("\n❌ No workflow runs found. Make sure GitHub CLI (gh) is installed and authenticated.")
        print("\nInstall: https://cli.github.com/")
        print("Authenticate: gh auth login")
        return

    print(f"\n📊 Analyzing last {len(runs)} workflow runs...\n")

    # Analyze each run
    for i, run in enumerate(runs, 1):
        run_id = run["databaseId"]
        conclusion = run["conclusion"]
        created_at = run["createdAt"]
        updated_at = run.get("updatedAt", created_at)

        # Calculate duration
        created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        updated = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
        duration = (updated - created).total_seconds() / 60

        status_emoji = {
            "success": "✅",
            "failure": "❌",
            "cancelled": "⏹️",
            None: "⏳"
        }.get(conclusion, "❓")

        print(f"{status_emoji} Run #{i}: {run['displayTitle']}")
        print(f"   Duration: {duration:.1f} minutes")
        print(f"   Status: {conclusion or 'in progress'}")

        # Get job details
        jobs = get_job_details(str(run_id))

        if jobs:
            print(f"   Jobs:")
            for job in jobs:
                job_name = job.get("name", "Unknown")
                job_status = job.get("conclusion", "running")
                job_started = job.get("startedAt")
                job_completed = job.get("completedAt")

                if job_started and job_completed:
                    started = datetime.fromisoformat(job_started.replace("Z", "+00:00"))
                    completed = datetime.fromisoformat(job_completed.replace("Z", "+00:00"))
                    job_duration = (completed - started).total_seconds() / 60

                    job_emoji = "✓" if job_status == "success" else "✗"
                    print(f"      {job_emoji} {job_name}: {job_duration:.1f}min")

        print()

    # Provide recommendations
    print("\n" + "=" * 80)
    print("💡 RECOMMENDATIONS")
    print("=" * 80)

    print("""
Based on the test pyramid implementation:

1. **Unit Test Performance**
   - Target: < 5 minutes
   - No database required
   - Current markers: @pytest.mark.unit
   - Run with: pytest -m unit tests/

2. **Integration Test Performance**
   - Target: < 20 minutes
   - Requires Postgres + Redis
   - Current markers: @pytest.mark.integration
   - Run with: pytest -m integration tests/

3. **E2E Test Performance**
   - Target: < 15 minutes
   - Full stack testing
   - Current markers: @pytest.mark.e2e
   - Run with: pytest -m e2e tests/

4. **Optimization Tips**
   - If unit tests exceed 5 min, review for database dependencies
   - Use pytest-xdist for parallel execution: pytest -n auto
   - Cache dependencies (Poetry cache, pnpm store)
   - Split large test files into smaller modules

5. **Monitoring Commands**
   ```bash
   # View latest runs
   gh run list --workflow=unified-ci.yml --limit 5

   # Watch a running workflow
   gh run watch

   # View specific job logs
   gh run view <run-id> --log --job <job-id>
   ```
    """)


def generate_report(output_file: str = None):
    """Generate markdown report."""
    report = [
        "# CI Performance Report",
        f"\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "\n## Workflow Analysis",
        "\n*(Run this script with GitHub CLI installed for detailed analysis)*",
        "\n## Current Configuration",
        "\n### Test Stages",
        "1. **Unit Tests** (5 min target)",
        "   - No external dependencies",
        "   - Fast feedback on logic errors",
        "   - Run on every PR",
        "",
        "2. **Integration Tests** (20 min target)",
        "   - Requires Postgres + Redis",
        "   - Tests service layer with real DB",
        "   - Runs after unit tests pass",
        "",
        "3. **E2E Tests** (15 min target)",
        "   - Full stack validation",
        "   - API endpoint testing",
        "   - Runs after integration tests pass",
        "\n### Performance Targets",
        "- **Total Pipeline**: ~40 minutes (staged)",
        "- **Fast Failure**: ~5 minutes (unit test failures)",
        "- **Parallel Execution**: Within each stage across Python versions",
        "\n### Monitoring Commands",
        "```bash",
        "# List recent runs",
        "gh run list --workflow=unified-ci.yml",
        "",
        "# View specific run",
        "gh run view <run-id>",
        "",
        "# Download artifacts",
        "gh run download <run-id>",
        "```",
    ]

    report_text = "\n".join(report)

    if output_file:
        with open(output_file, "w") as f:
            f.write(report_text)
        print(f"✅ Report saved to: {output_file}")
    else:
        print(report_text)


def main():
    parser = argparse.ArgumentParser(
        description="Monitor CI pipeline performance"
    )
    parser.add_argument(
        "--output", "-o",
        help="Save report to file",
        default=None
    )
    parser.add_argument(
        "--report-only", "-r",
        action="store_true",
        help="Generate report without GitHub API calls"
    )

    args = parser.parse_args()

    if args.report_only:
        generate_report(args.output)
    else:
        analyze_workflow_performance()
        if args.output:
            print(f"\nGenerating report...")
            generate_report(args.output)


if __name__ == "__main__":
    main()
