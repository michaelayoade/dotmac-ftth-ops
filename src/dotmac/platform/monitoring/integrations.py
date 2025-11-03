"""
Simple Prometheus monitoring integration.

Basic Prometheus metrics exposure. Other monitoring integrations
can be added later via settings configuration.
"""

from dataclasses import dataclass
from datetime import UTC, datetime

import structlog

logger = structlog.get_logger(__name__)


@dataclass
class MetricData:
    """Simple metric data structure."""

    name: str
    value: int | float
    labels: dict[str, str] | None = None
    timestamp: datetime | None = None

    def __post_init__(self) -> None:
        if self.timestamp is None:
            self.timestamp = datetime.now(UTC)
        if self.labels is None:
            self.labels = {}


class PrometheusIntegration:
    """Simple Prometheus metrics integration."""

    def __init__(self) -> None:
        self.metrics: list[MetricData] = []
        self.logger = logger.bind(integration="prometheus")

    def record_metric(
        self, name: str, value: int | float, labels: dict[str, str] | None = None
    ) -> None:
        """Record a metric for Prometheus export."""
        metric = MetricData(name=name, value=value, labels=labels)
        self.metrics.append(metric)
        self.logger.debug("Metric recorded", name=name, value=value)

    def get_metrics(self) -> list[MetricData]:
        """Get all recorded metrics."""
        return self.metrics.copy()

    def clear_metrics(self) -> None:
        """Clear all metrics."""
        self.metrics.clear()

    def to_prometheus_format(self) -> str:
        """Convert metrics to Prometheus text format."""
        lines = []

        for metric in self.metrics:
            # Build labels string
            if metric.labels:
                label_str = ",".join(f'{k}="{v}"' for k, v in metric.labels.items())
                metric_line = f"{metric.name}{{{label_str}}} {metric.value}"
            else:
                metric_line = f"{metric.name} {metric.value}"

            lines.append(metric_line)

        return "\n".join(lines)
