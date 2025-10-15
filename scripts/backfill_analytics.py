#!/usr/bin/env python
"""
Analytics and backfill scripts for data import operations.

Provides tools for analyzing import performance, generating reports,
and backfilling missing data from historical imports.

Usage:
    python scripts/backfill_analytics.py analyze-performance --days 30
    python scripts/backfill_analytics.py generate-report --job-id <job_id>
    python scripts/backfill_analytics.py backfill-metrics --start-date 2024-01-01
    python scripts/backfill_analytics.py export-metrics --format json
"""

import asyncio
import json

# Add src to path
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID

import typer
from rich.console import Console
from rich.progress import track
from rich.table import Table
from sqlalchemy import func, select

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.dotmac.platform.data_import.models import (
    ImportFailure,
    ImportJob,
    ImportJobStatus,
)
from src.dotmac.platform.database import get_db_session, init_db

app = typer.Typer(help="Data import analytics and backfill tools")
console = Console()


@app.command()
def analyze_performance(
    days: int = typer.Option(30, "--days", "-d", help="Number of days to analyze"),
    tenant_id: str | None = typer.Option(None, "--tenant-id", "-t", help="Filter by tenant ID"),
    export_csv: bool = typer.Option(False, "--export-csv", help="Export results to CSV"),
):
    """
    Analyze import job performance over time.

    Generates metrics on success rates, processing times,
    and common failure patterns.
    """
    asyncio.run(_analyze_performance(days, tenant_id, export_csv))


async def _analyze_performance(days: int, tenant_id: str | None, export_csv: bool):
    """Async implementation of performance analysis."""
    await init_db()

    async with get_db_session() as session:
        start_date = datetime.now(UTC) - timedelta(days=days)

        # Build base query
        query = select(ImportJob).where(ImportJob.created_at >= start_date)
        if tenant_id:
            query = query.where(ImportJob.tenant_id == tenant_id)

        result = await session.execute(query)
        jobs = result.scalars().all()

        if not jobs:
            console.print("[yellow]No import jobs found in the specified period[/yellow]")
            return

        # Calculate metrics
        metrics = calculate_performance_metrics(jobs)

        # Display results
        display_performance_metrics(metrics)

        # Export if requested
        if export_csv:
            export_performance_csv(
                metrics, f"import_performance_{datetime.now().strftime('%Y%m%d')}.csv"
            )


def calculate_performance_metrics(jobs: list[ImportJob]) -> dict[str, Any]:
    """Calculate comprehensive performance metrics."""
    total_jobs = len(jobs)

    # Status distribution
    status_counts = {}
    for job in jobs:
        status = job.status.value
        status_counts[status] = status_counts.get(status, 0) + 1

    # Type distribution
    type_counts = {}
    for job in jobs:
        job_type = job.job_type.value
        type_counts[job_type] = type_counts.get(job_type, 0) + 1

    # Success metrics
    successful_jobs = [j for j in jobs if j.status == ImportJobStatus.COMPLETED]
    failed_jobs = [j for j in jobs if j.status == ImportJobStatus.FAILED]
    partial_jobs = [j for j in jobs if j.status == ImportJobStatus.PARTIALLY_COMPLETED]

    total_records = sum(j.total_records for j in jobs)
    successful_records = sum(j.successful_records for j in jobs)
    failed_records = sum(j.failed_records for j in jobs)

    # Processing time metrics
    completed_jobs = successful_jobs + failed_jobs + partial_jobs
    processing_times = []
    for job in completed_jobs:
        if job.duration_seconds:
            processing_times.append(job.duration_seconds)

    avg_processing_time = sum(processing_times) / len(processing_times) if processing_times else 0
    max_processing_time = max(processing_times) if processing_times else 0
    min_processing_time = min(processing_times) if processing_times else 0

    # File size metrics
    file_sizes = [j.file_size for j in jobs]
    avg_file_size = sum(file_sizes) / len(file_sizes) if file_sizes else 0

    # Records per second (throughput)
    throughput_rates = []
    for job in completed_jobs:
        if job.duration_seconds and job.duration_seconds > 0:
            rate = job.processed_records / job.duration_seconds
            throughput_rates.append(rate)

    avg_throughput = sum(throughput_rates) / len(throughput_rates) if throughput_rates else 0

    # Daily breakdown
    daily_stats = {}
    for job in jobs:
        date_key = job.created_at.date().isoformat()
        if date_key not in daily_stats:
            daily_stats[date_key] = {"total": 0, "successful": 0, "failed": 0, "records": 0}

        daily_stats[date_key]["total"] += 1
        daily_stats[date_key]["records"] += job.total_records

        if job.status == ImportJobStatus.COMPLETED:
            daily_stats[date_key]["successful"] += 1
        elif job.status == ImportJobStatus.FAILED:
            daily_stats[date_key]["failed"] += 1

    return {
        "summary": {
            "total_jobs": total_jobs,
            "successful_jobs": len(successful_jobs),
            "failed_jobs": len(failed_jobs),
            "partial_jobs": len(partial_jobs),
            "success_rate": (len(successful_jobs) / total_jobs * 100) if total_jobs > 0 else 0,
            "total_records": total_records,
            "successful_records": successful_records,
            "failed_records": failed_records,
            "record_success_rate": (
                (successful_records / total_records * 100) if total_records > 0 else 0
            ),
        },
        "status_distribution": status_counts,
        "type_distribution": type_counts,
        "processing": {
            "avg_time_seconds": avg_processing_time,
            "max_time_seconds": max_processing_time,
            "min_time_seconds": min_processing_time,
            "avg_throughput_records_per_sec": avg_throughput,
            "avg_file_size_bytes": avg_file_size,
        },
        "daily_stats": daily_stats,
    }


def display_performance_metrics(metrics: dict[str, Any]):
    """Display performance metrics in a formatted table."""
    console.print("\n[bold cyan]Import Performance Analytics[/bold cyan]\n")

    # Summary table
    summary_table = Table(title="Summary Metrics")
    summary_table.add_column("Metric", style="cyan")
    summary_table.add_column("Value", style="green")

    summary = metrics["summary"]
    summary_table.add_row("Total Jobs", str(summary["total_jobs"]))
    summary_table.add_row("Successful Jobs", str(summary["successful_jobs"]))
    summary_table.add_row("Failed Jobs", str(summary["failed_jobs"]))
    summary_table.add_row("Partial Jobs", str(summary["partial_jobs"]))
    summary_table.add_row("Success Rate", f"{summary['success_rate']:.1f}%")
    summary_table.add_row("Total Records", f"{summary['total_records']:,}")
    summary_table.add_row("Successful Records", f"{summary['successful_records']:,}")
    summary_table.add_row("Failed Records", f"{summary['failed_records']:,}")
    summary_table.add_row("Record Success Rate", f"{summary['record_success_rate']:.1f}%")

    console.print(summary_table)

    # Processing metrics
    processing_table = Table(title="Processing Metrics")
    processing_table.add_column("Metric", style="cyan")
    processing_table.add_column("Value", style="yellow")

    proc = metrics["processing"]
    processing_table.add_row("Avg Processing Time", f"{proc['avg_time_seconds']:.1f} seconds")
    processing_table.add_row("Max Processing Time", f"{proc['max_time_seconds']:.1f} seconds")
    processing_table.add_row("Min Processing Time", f"{proc['min_time_seconds']:.1f} seconds")
    processing_table.add_row(
        "Avg Throughput", f"{proc['avg_throughput_records_per_sec']:.1f} records/sec"
    )
    processing_table.add_row("Avg File Size", f"{proc['avg_file_size_bytes'] / 1024 / 1024:.2f} MB")

    console.print(processing_table)

    # Status distribution
    status_table = Table(title="Status Distribution")
    status_table.add_column("Status", style="cyan")
    status_table.add_column("Count", style="white")
    status_table.add_column("Percentage", style="white")

    total = sum(metrics["status_distribution"].values())
    for status, count in metrics["status_distribution"].items():
        percentage = (count / total * 100) if total > 0 else 0
        status_table.add_row(status, str(count), f"{percentage:.1f}%")

    console.print(status_table)

    # Type distribution
    type_table = Table(title="Import Type Distribution")
    type_table.add_column("Type", style="cyan")
    type_table.add_column("Count", style="white")
    type_table.add_column("Percentage", style="white")

    total = sum(metrics["type_distribution"].values())
    for import_type, count in metrics["type_distribution"].items():
        percentage = (count / total * 100) if total > 0 else 0
        type_table.add_row(import_type, str(count), f"{percentage:.1f}%")

    console.print(type_table)

    # Daily trends
    daily_table = Table(title="Daily Trends (Last 7 Days)")
    daily_table.add_column("Date", style="cyan")
    daily_table.add_column("Total", style="white")
    daily_table.add_column("Success", style="green")
    daily_table.add_column("Failed", style="red")
    daily_table.add_column("Records", style="white")

    sorted_days = sorted(metrics["daily_stats"].items(), reverse=True)[:7]
    for date, stats in sorted_days:
        daily_table.add_row(
            date,
            str(stats["total"]),
            str(stats["successful"]),
            str(stats["failed"]),
            f"{stats['records']:,}",
        )

    console.print(daily_table)


def export_performance_csv(metrics: dict[str, Any], filename: str):
    """Export performance metrics to CSV."""
    import csv

    with open(filename, "w", newline="") as csvfile:
        writer = csv.writer(csvfile)

        # Summary section
        writer.writerow(["Summary Metrics"])
        writer.writerow(["Metric", "Value"])
        for key, value in metrics["summary"].items():
            writer.writerow([key, value])
        writer.writerow([])

        # Processing metrics
        writer.writerow(["Processing Metrics"])
        writer.writerow(["Metric", "Value"])
        for key, value in metrics["processing"].items():
            writer.writerow([key, value])
        writer.writerow([])

        # Daily stats
        writer.writerow(["Daily Statistics"])
        writer.writerow(["Date", "Total Jobs", "Successful", "Failed", "Records"])
        for date, stats in sorted(metrics["daily_stats"].items()):
            writer.writerow(
                [date, stats["total"], stats["successful"], stats["failed"], stats["records"]]
            )

    console.print(f"[green]Performance metrics exported to {filename}[/green]")


@app.command()
def generate_report(
    job_id: str = typer.Argument(..., help="Import job ID to generate report for"),
    include_failures: bool = typer.Option(
        True, "--include-failures", help="Include failure analysis"
    ),
    output_format: str = typer.Option(
        "console", "--format", "-f", help="Output format (console, json, html)"
    ),
):
    """
    Generate detailed report for a specific import job.

    Includes timing analysis, error patterns, and recommendations.
    """
    asyncio.run(_generate_report(job_id, include_failures, output_format))


async def _generate_report(job_id: str, include_failures: bool, output_format: str):
    """Async implementation of report generation."""
    await init_db()

    async with get_db_session() as session:
        # Get job details
        job = await session.get(ImportJob, UUID(job_id))

        if not job:
            console.print(f"[red]Import job {job_id} not found[/red]")
            raise typer.Exit(1)

        # Get failures if requested
        failures = []
        if include_failures and job.failed_records > 0:
            result = await session.execute(
                select(ImportFailure).where(ImportFailure.job_id == job.id).limit(100)
            )
            failures = result.scalars().all()

        # Generate report
        report = generate_job_report(job, failures)

        # Output based on format
        if output_format == "json":
            print(json.dumps(report, indent=2, default=str))
        elif output_format == "html":
            html_content = generate_html_report(report)
            filename = f"import_report_{job_id[:8]}.html"
            with open(filename, "w") as f:
                f.write(html_content)
            console.print(f"[green]Report saved to {filename}[/green]")
        else:
            display_job_report(report)


def generate_job_report(job: ImportJob, failures: list[ImportFailure]) -> dict[str, Any]:
    """Generate comprehensive job report."""
    report = {
        "job_id": str(job.id),
        "job_type": job.job_type.value,
        "status": job.status.value,
        "file_info": {"name": job.file_name, "size": job.file_size, "format": job.file_format},
        "metrics": {
            "total_records": job.total_records,
            "processed_records": job.processed_records,
            "successful_records": job.successful_records,
            "failed_records": job.failed_records,
            "progress_percentage": job.progress_percentage,
            "success_rate": job.success_rate,
        },
        "timing": {
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "duration_seconds": job.duration_seconds,
        },
        "tenant_id": job.tenant_id,
        "initiated_by": str(job.initiated_by) if job.initiated_by else None,
    }

    # Add failure analysis
    if failures:
        error_patterns = {}
        for failure in failures:
            error_type = failure.error_type
            if error_type not in error_patterns:
                error_patterns[error_type] = {"count": 0, "examples": []}

            error_patterns[error_type]["count"] += 1
            if len(error_patterns[error_type]["examples"]) < 3:
                error_patterns[error_type]["examples"].append(
                    {"row": failure.row_number, "message": failure.error_message[:100]}
                )

        report["failure_analysis"] = {
            "total_failures": len(failures),
            "error_patterns": error_patterns,
        }

    # Add performance analysis
    if job.duration_seconds and job.processed_records:
        throughput = job.processed_records / job.duration_seconds
        report["performance"] = {
            "throughput_records_per_sec": throughput,
            "avg_time_per_record_ms": (job.duration_seconds * 1000) / job.processed_records,
        }

    # Add recommendations
    recommendations = []

    if job.success_rate < 80:
        recommendations.append(
            "Low success rate detected. Review validation rules and data quality."
        )

    if job.duration_seconds and job.duration_seconds > 3600:
        recommendations.append(
            "Long processing time. Consider using smaller batch sizes or async processing."
        )

    if failures:
        validation_errors = sum(1 for f in failures if f.error_type == "validation")
        if validation_errors > len(failures) * 0.5:
            recommendations.append(
                "High validation error rate. Review data format and field requirements."
            )

    report["recommendations"] = recommendations

    return report


def display_job_report(report: dict[str, Any]):
    """Display job report in console."""
    console.print("\n[bold cyan]Import Job Report[/bold cyan]")
    console.print(f"Job ID: {report['job_id'][:8]}")
    console.print(f"Type: {report['job_type']}")
    console.print(f"Status: {report['status']}\n")

    # File info
    file_table = Table(title="File Information")
    file_table.add_column("Property", style="cyan")
    file_table.add_column("Value", style="white")

    file_info = report["file_info"]
    file_table.add_row("Name", file_info["name"])
    file_table.add_row("Size", f"{file_info['size'] / 1024 / 1024:.2f} MB")
    file_table.add_row("Format", file_info["format"].upper())

    console.print(file_table)

    # Metrics
    metrics_table = Table(title="Processing Metrics")
    metrics_table.add_column("Metric", style="cyan")
    metrics_table.add_column("Value", style="green")

    metrics = report["metrics"]
    metrics_table.add_row("Total Records", f"{metrics['total_records']:,}")
    metrics_table.add_row("Processed", f"{metrics['processed_records']:,}")
    metrics_table.add_row("Successful", f"{metrics['successful_records']:,}")
    metrics_table.add_row("Failed", f"{metrics['failed_records']:,}")
    metrics_table.add_row("Success Rate", f"{metrics['success_rate']:.1f}%")

    console.print(metrics_table)

    # Performance
    if "performance" in report:
        perf_table = Table(title="Performance Analysis")
        perf_table.add_column("Metric", style="cyan")
        perf_table.add_column("Value", style="yellow")

        perf = report["performance"]
        perf_table.add_row("Throughput", f"{perf['throughput_records_per_sec']:.1f} records/sec")
        perf_table.add_row("Avg Time per Record", f"{perf['avg_time_per_record_ms']:.2f} ms")

        console.print(perf_table)

    # Failure analysis
    if "failure_analysis" in report:
        console.print("\n[bold red]Failure Analysis[/bold red]")
        console.print(f"Total Failures: {report['failure_analysis']['total_failures']}")

        for error_type, data in report["failure_analysis"]["error_patterns"].items():
            console.print(f"\n[yellow]{error_type}[/yellow]: {data['count']} occurrences")
            for example in data["examples"]:
                console.print(f"  Row {example['row']}: {example['message']}")

    # Recommendations
    if report["recommendations"]:
        console.print("\n[bold yellow]Recommendations[/bold yellow]")
        for i, rec in enumerate(report["recommendations"], 1):
            console.print(f"{i}. {rec}")


def generate_html_report(report: dict[str, Any]) -> str:
    """Generate HTML report."""
    html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Import Report - {report["job_id"][:8]}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        h1 {{ color: #333; }}
        table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f2f2f2; }}
        .success {{ color: green; }}
        .error {{ color: red; }}
        .warning {{ color: orange; }}
    </style>
</head>
<body>
    <h1>Import Job Report</h1>
    <p><strong>Job ID:</strong> {report["job_id"]}</p>
    <p><strong>Type:</strong> {report["job_type"]}</p>
    <p><strong>Status:</strong> {report["status"]}</p>

    <h2>File Information</h2>
    <table>
        <tr><th>Property</th><th>Value</th></tr>
        <tr><td>Name</td><td>{report["file_info"]["name"]}</td></tr>
        <tr><td>Size</td><td>{report["file_info"]["size"] / 1024 / 1024:.2f} MB</td></tr>
        <tr><td>Format</td><td>{report["file_info"]["format"].upper()}</td></tr>
    </table>

    <h2>Processing Metrics</h2>
    <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Total Records</td><td>{report["metrics"]["total_records"]:,}</td></tr>
        <tr><td>Processed</td><td>{report["metrics"]["processed_records"]:,}</td></tr>
        <tr><td class="success">Successful</td><td>{report["metrics"]["successful_records"]:,}</td></tr>
        <tr><td class="error">Failed</td><td>{report["metrics"]["failed_records"]:,}</td></tr>
        <tr><td>Success Rate</td><td>{report["metrics"]["success_rate"]:.1f}%</td></tr>
    </table>
"""

    if "recommendations" in report and report["recommendations"]:
        html += """
    <h2>Recommendations</h2>
    <ul>
"""
        for rec in report["recommendations"]:
            html += f"        <li>{rec}</li>\n"
        html += "    </ul>\n"

    html += """
</body>
</html>
"""
    return html


@app.command()
def backfill_metrics(
    start_date: str = typer.Option(..., "--start-date", "-s", help="Start date (YYYY-MM-DD)"),
    end_date: str | None = typer.Option(None, "--end-date", "-e", help="End date (YYYY-MM-DD)"),
    recalculate: bool = typer.Option(False, "--recalculate", help="Recalculate existing metrics"),
):
    """
    Backfill missing metrics for historical import jobs.

    Useful for jobs that were imported before metrics tracking was added.
    """
    asyncio.run(_backfill_metrics(start_date, end_date, recalculate))


async def _backfill_metrics(start_date: str, end_date: str | None, recalculate: bool):
    """Async implementation of metrics backfill."""
    await init_db()

    start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=UTC)
    end_dt = (
        datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=UTC)
        if end_date
        else datetime.now(UTC)
    )

    async with get_db_session() as session:
        # Find jobs needing backfill
        query = select(ImportJob).where(
            ImportJob.created_at >= start_dt, ImportJob.created_at <= end_dt
        )

        if not recalculate:
            # Only get jobs missing metrics
            query = query.where((ImportJob.processed_records == 0) | (ImportJob.summary == None))

        result = await session.execute(query)
        jobs = result.scalars().all()

        if not jobs:
            console.print("[yellow]No jobs found requiring backfill[/yellow]")
            return

        console.print(f"[cyan]Found {len(jobs)} jobs to backfill[/cyan]")

        updated = 0
        for job in track(jobs, description="Backfilling metrics..."):
            try:
                # Recalculate metrics
                if job.total_records == 0:
                    # Count from failures + successes
                    result = await session.execute(
                        select(func.count(ImportFailure.id)).where(ImportFailure.job_id == job.id)
                    )
                    failure_count = result.scalar() or 0

                    job.failed_records = failure_count
                    job.total_records = job.successful_records + failure_count

                # Calculate duration if missing
                if not job.duration_seconds and job.started_at and job.completed_at:
                    job.duration_seconds = (job.completed_at - job.started_at).total_seconds()

                # Update summary
                if not job.summary or recalculate:
                    job.summary = {
                        "total_records": job.total_records,
                        "successful_records": job.successful_records,
                        "failed_records": job.failed_records,
                        "success_rate": job.success_rate,
                        "duration_seconds": job.duration_seconds,
                        "backfilled": True,
                        "backfilled_at": datetime.now(UTC).isoformat(),
                    }

                await session.commit()
                updated += 1

            except Exception as e:
                console.print(f"[red]Failed to backfill job {job.id}: {e}[/red]")
                await session.rollback()

        console.print(f"[green]Successfully backfilled {updated} jobs[/green]")


@app.command()
def export_metrics(
    format: str = typer.Option("json", "--format", "-f", help="Export format (json, csv)"),
    start_date: str | None = typer.Option(
        None, "--start-date", "-s", help="Start date (YYYY-MM-DD)"
    ),
    end_date: str | None = typer.Option(None, "--end-date", "-e", help="End date (YYYY-MM-DD)"),
):
    """
    Export import metrics for external analysis.

    Useful for integration with BI tools or custom dashboards.
    """
    asyncio.run(_export_metrics(format, start_date, end_date))


async def _export_metrics(format: str, start_date: str | None, end_date: str | None):
    """Async implementation of metrics export."""
    await init_db()

    async with get_db_session() as session:
        query = select(ImportJob)

        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=UTC)
            query = query.where(ImportJob.created_at >= start_dt)

        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=UTC)
            query = query.where(ImportJob.created_at <= end_dt)

        result = await session.execute(query)
        jobs = result.scalars().all()

        if not jobs:
            console.print("[yellow]No jobs found to export[/yellow]")
            return

        # Convert to export format
        export_data = []
        for job in jobs:
            export_data.append(
                {
                    "job_id": str(job.id),
                    "job_type": job.job_type.value,
                    "status": job.status.value,
                    "file_name": job.file_name,
                    "file_size": job.file_size,
                    "total_records": job.total_records,
                    "successful_records": job.successful_records,
                    "failed_records": job.failed_records,
                    "success_rate": job.success_rate,
                    "duration_seconds": job.duration_seconds,
                    "tenant_id": job.tenant_id,
                    "created_at": job.created_at.isoformat() if job.created_at else None,
                    "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                }
            )

        # Export based on format
        filename = f"import_metrics_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        if format == "csv":
            import csv

            filename += ".csv"
            with open(filename, "w", newline="") as csvfile:
                if export_data:
                    writer = csv.DictWriter(csvfile, fieldnames=export_data[0].keys())
                    writer.writeheader()
                    writer.writerows(export_data)
        else:
            filename += ".json"
            with open(filename, "w") as jsonfile:
                json.dump(export_data, jsonfile, indent=2)

        console.print(f"[green]Metrics exported to {filename}[/green]")
        console.print(f"Total jobs exported: {len(export_data)}")


if __name__ == "__main__":
    app()
