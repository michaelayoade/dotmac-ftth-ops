"""Tests for Prometheus metrics exporter."""

from unittest.mock import MagicMock, patch

import pytest

from dotmac.platform.monitoring.dual_stack_metrics import DualStackMetrics
from dotmac.platform.monitoring.prometheus_exporter import PrometheusExporter


@pytest.mark.unit
class TestPrometheusExporter:
    """Test PrometheusExporter class."""

    @pytest.fixture
    def mock_metrics(self):
        """Create mock DualStackMetrics."""
        metrics = DualStackMetrics()
        # Subscriber metrics
        metrics.total_subscribers = 100
        metrics.dual_stack_subscribers = 75
        metrics.ipv4_only_subscribers = 20
        metrics.ipv6_only_subscribers = 5
        metrics.dual_stack_percentage = 75.0
        # IP allocation metrics
        metrics.total_ipv4_allocated = 90
        metrics.total_ipv6_allocated = 80
        metrics.ipv4_pool_utilization = 45.0
        metrics.ipv6_prefix_utilization = 40.0
        metrics.available_ipv4_addresses = 110
        metrics.available_ipv6_prefixes = 500
        # Traffic metrics
        metrics.ipv4_traffic_percentage = 60.0
        metrics.ipv6_traffic_percentage = 40.0
        metrics.ipv4_bandwidth_mbps = 1500.0
        metrics.ipv6_bandwidth_mbps = 1000.0
        # Connectivity metrics
        metrics.ipv4_reachable_devices = 85
        metrics.ipv6_reachable_devices = 75
        metrics.dual_stack_reachable_devices = 70
        metrics.ipv4_connectivity_percentage = 94.4
        metrics.ipv6_connectivity_percentage = 93.8
        # Performance metrics
        metrics.avg_ipv4_latency_ms = 15.5
        metrics.avg_ipv6_latency_ms = 14.2
        metrics.ipv4_packet_loss_percentage = 0.5
        metrics.ipv6_packet_loss_percentage = 0.3
        # WireGuard metrics
        metrics.wireguard_servers = 3
        metrics.wireguard_dual_stack_servers = 2
        metrics.wireguard_peers = 50
        metrics.wireguard_dual_stack_peers = 35
        # Migration metrics
        metrics.migration_started = 10
        metrics.migration_completed = 8
        metrics.migration_failed = 2
        metrics.migration_progress_percentage = 80.0
        return metrics

    def test_export_metrics_subscriber_metrics(self, mock_metrics):
        """Test exporting subscriber metrics."""
        with patch("dotmac.platform.monitoring.prometheus_exporter.subscriber_total") as mock_total:
            mock_gauge = MagicMock()
            mock_total.labels.return_value = mock_gauge

            PrometheusExporter.export_metrics(mock_metrics, tenant_id="test-tenant")

            mock_total.labels.assert_called_with(tenant_id="test-tenant")
            mock_gauge.set.assert_called_with(100)

    def test_export_metrics_dual_stack_percentage(self, mock_metrics):
        """Test exporting dual-stack percentage."""
        with patch(
            "dotmac.platform.monitoring.prometheus_exporter.dual_stack_percentage"
        ) as mock_pct:
            mock_gauge = MagicMock()
            mock_pct.labels.return_value = mock_gauge

            PrometheusExporter.export_metrics(mock_metrics, tenant_id="test-tenant")

            mock_pct.labels.assert_called_with(tenant_id="test-tenant")
            mock_gauge.set.assert_called_with(75.0)

    def test_export_metrics_ip_allocation(self, mock_metrics):
        """Test exporting IP allocation metrics."""
        with patch("dotmac.platform.monitoring.prometheus_exporter.ipv4_allocated") as mock_ipv4:
            mock_gauge = MagicMock()
            mock_ipv4.labels.return_value = mock_gauge

            PrometheusExporter.export_metrics(mock_metrics, tenant_id="test-tenant")

            mock_ipv4.labels.assert_called_with(tenant_id="test-tenant")
            mock_gauge.set.assert_called_with(90)

    def test_export_metrics_traffic(self, mock_metrics):
        """Test exporting traffic metrics."""
        with patch("dotmac.platform.monitoring.prometheus_exporter.bandwidth_ipv4_mbps") as mock_bw:
            mock_gauge = MagicMock()
            mock_bw.labels.return_value = mock_gauge

            PrometheusExporter.export_metrics(mock_metrics, tenant_id="test-tenant")

            mock_bw.labels.assert_called_with(tenant_id="test-tenant")
            mock_gauge.set.assert_called_with(1500.0)

    def test_export_metrics_connectivity(self, mock_metrics):
        """Test exporting connectivity metrics."""
        with patch(
            "dotmac.platform.monitoring.prometheus_exporter.devices_ipv4_reachable"
        ) as mock_devices:
            mock_gauge = MagicMock()
            mock_devices.labels.return_value = mock_gauge

            PrometheusExporter.export_metrics(mock_metrics, tenant_id="test-tenant")

            mock_devices.labels.assert_called_with(tenant_id="test-tenant")
            mock_gauge.set.assert_called_with(85)

    def test_export_metrics_performance(self, mock_metrics):
        """Test exporting performance metrics."""
        with patch("dotmac.platform.monitoring.prometheus_exporter.latency_ipv4_ms") as mock_lat:
            mock_gauge = MagicMock()
            mock_lat.labels.return_value = mock_gauge

            PrometheusExporter.export_metrics(mock_metrics, tenant_id="test-tenant")

            mock_lat.labels.assert_called_with(tenant_id="test-tenant")
            mock_gauge.set.assert_called_with(15.5)

    def test_export_metrics_wireguard(self, mock_metrics):
        """Test exporting WireGuard metrics."""
        with patch(
            "dotmac.platform.monitoring.prometheus_exporter.wireguard_servers_total"
        ) as mock_wg:
            mock_gauge = MagicMock()
            mock_wg.labels.return_value = mock_gauge

            PrometheusExporter.export_metrics(mock_metrics, tenant_id="test-tenant")

            mock_wg.labels.assert_called_with(tenant_id="test-tenant")
            mock_gauge.set.assert_called_with(3)

    def test_export_metrics_migration(self, mock_metrics):
        """Test exporting migration metrics."""
        with patch(
            "dotmac.platform.monitoring.prometheus_exporter.migration_progress_percentage"
        ) as mock_progress:
            mock_gauge = MagicMock()
            mock_progress.labels.return_value = mock_gauge

            PrometheusExporter.export_metrics(mock_metrics, tenant_id="test-tenant")

            mock_progress.labels.assert_called_with(tenant_id="test-tenant")
            mock_gauge.set.assert_called_with(80.0)

    def test_export_metrics_default_tenant(self, mock_metrics):
        """Test export metrics with default tenant ID."""
        with patch("dotmac.platform.monitoring.prometheus_exporter.subscriber_total") as mock_total:
            mock_gauge = MagicMock()
            mock_total.labels.return_value = mock_gauge

            PrometheusExporter.export_metrics(mock_metrics)

            mock_total.labels.assert_called_with(tenant_id="global")

    def test_record_subscriber_provisioned(self):
        """Test recording subscriber provisioned event."""
        with patch(
            "dotmac.platform.monitoring.prometheus_exporter.subscriber_provisioned"
        ) as mock_counter:
            mock_counter_obj = MagicMock()
            mock_counter.labels.return_value = mock_counter_obj

            PrometheusExporter.record_subscriber_provisioned("test-tenant", "dual_stack")

            mock_counter.labels.assert_called_with(tenant_id="test-tenant", ip_type="dual_stack")
            mock_counter_obj.inc.assert_called_once()

    def test_record_subscriber_deprovisioned(self):
        """Test recording subscriber deprovisioned event."""
        with patch(
            "dotmac.platform.monitoring.prometheus_exporter.subscriber_deprovisioned"
        ) as mock_counter:
            mock_counter_obj = MagicMock()
            mock_counter.labels.return_value = mock_counter_obj

            PrometheusExporter.record_subscriber_deprovisioned("test-tenant", "ipv4_only")

            mock_counter.labels.assert_called_with(tenant_id="test-tenant", ip_type="ipv4_only")
            mock_counter_obj.inc.assert_called_once()

    def test_record_ip_allocation_success(self):
        """Test recording successful IP allocation."""
        with patch(
            "dotmac.platform.monitoring.prometheus_exporter.ip_allocation_success"
        ) as mock_counter:
            mock_counter_obj = MagicMock()
            mock_counter.labels.return_value = mock_counter_obj

            PrometheusExporter.record_ip_allocation_success("test-tenant", "ipv6")

            mock_counter.labels.assert_called_with(tenant_id="test-tenant", ip_version="ipv6")
            mock_counter_obj.inc.assert_called_once()

    def test_record_ip_allocation_failure(self):
        """Test recording failed IP allocation."""
        with patch(
            "dotmac.platform.monitoring.prometheus_exporter.ip_allocation_failure"
        ) as mock_counter:
            mock_counter_obj = MagicMock()
            mock_counter.labels.return_value = mock_counter_obj

            PrometheusExporter.record_ip_allocation_failure("test-tenant", "ipv4", "pool_exhausted")

            mock_counter.labels.assert_called_with(
                tenant_id="test-tenant", ip_version="ipv4", reason="pool_exhausted"
            )
            mock_counter_obj.inc.assert_called_once()

    def test_record_latency(self):
        """Test recording latency measurement."""
        with patch(
            "dotmac.platform.monitoring.prometheus_exporter.latency_histogram"
        ) as mock_histogram:
            mock_hist_obj = MagicMock()
            mock_histogram.labels.return_value = mock_hist_obj

            PrometheusExporter.record_latency("test-tenant", "ipv4", 25.5)

            mock_histogram.labels.assert_called_with(tenant_id="test-tenant", ip_version="ipv4")
            mock_hist_obj.observe.assert_called_with(25.5)

    def test_set_platform_info(self):
        """Test setting platform information."""
        with patch("dotmac.platform.monitoring.prometheus_exporter.platform_info") as mock_info:
            PrometheusExporter.set_platform_info("1.0.0", "production")

            mock_info.info.assert_called_with(
                {
                    "version": "1.0.0",
                    "environment": "production",
                    "dual_stack_enabled": "true",
                }
            )


@pytest.mark.unit
class TestPrometheusExporterIntegration:
    """Integration tests for PrometheusExporter."""

    @pytest.fixture
    def mock_metrics(self):
        """Create mock DualStackMetrics."""
        metrics = DualStackMetrics()
        metrics.total_subscribers = 50
        metrics.dual_stack_subscribers = 40
        metrics.ipv4_only_subscribers = 8
        metrics.ipv6_only_subscribers = 2
        metrics.dual_stack_percentage = 80.0
        metrics.total_ipv4_allocated = 48
        metrics.total_ipv6_allocated = 42
        metrics.ipv4_pool_utilization = 24.0
        metrics.ipv6_prefix_utilization = 21.0
        metrics.available_ipv4_addresses = 152
        metrics.available_ipv6_prefixes = 458
        metrics.ipv4_traffic_percentage = 55.0
        metrics.ipv6_traffic_percentage = 45.0
        metrics.ipv4_bandwidth_mbps = 2200.0
        metrics.ipv6_bandwidth_mbps = 1800.0
        metrics.ipv4_reachable_devices = 46
        metrics.ipv6_reachable_devices = 40
        metrics.dual_stack_reachable_devices = 38
        metrics.ipv4_connectivity_percentage = 95.8
        metrics.ipv6_connectivity_percentage = 95.2
        metrics.avg_ipv4_latency_ms = 12.3
        metrics.avg_ipv6_latency_ms = 11.8
        metrics.ipv4_packet_loss_percentage = 0.2
        metrics.ipv6_packet_loss_percentage = 0.15
        metrics.wireguard_servers = 5
        metrics.wireguard_dual_stack_servers = 4
        metrics.wireguard_peers = 100
        metrics.wireguard_dual_stack_peers = 85
        metrics.migration_started = 15
        metrics.migration_completed = 12
        metrics.migration_failed = 3
        metrics.migration_progress_percentage = 80.0
        return metrics

    def test_export_metrics_all_fields(self, mock_metrics):
        """Test that export_metrics sets all metric fields."""
        with (
            patch("dotmac.platform.monitoring.prometheus_exporter.subscriber_total") as m1,
            patch("dotmac.platform.monitoring.prometheus_exporter.subscriber_dual_stack") as m2,
            patch("dotmac.platform.monitoring.prometheus_exporter.subscriber_ipv4_only") as m3,
            patch("dotmac.platform.monitoring.prometheus_exporter.subscriber_ipv6_only") as m4,
            patch("dotmac.platform.monitoring.prometheus_exporter.dual_stack_percentage") as m5,
        ):
            # Setup mock gauges
            for mock_metric in [m1, m2, m3, m4, m5]:
                mock_metric.labels.return_value = MagicMock()

            PrometheusExporter.export_metrics(mock_metrics, "tenant-1")

            # Verify all metrics were called
            m1.labels.assert_called_once()
            m2.labels.assert_called_once()
            m3.labels.assert_called_once()
            m4.labels.assert_called_once()
            m5.labels.assert_called_once()

    def test_multiple_tenant_exports(self, mock_metrics):
        """Test exporting metrics for multiple tenants."""
        with patch("dotmac.platform.monitoring.prometheus_exporter.subscriber_total") as mock_total:
            mock_gauge1 = MagicMock()
            mock_gauge2 = MagicMock()
            mock_total.labels.side_effect = [mock_gauge1, mock_gauge2]

            # Export for two different tenants
            PrometheusExporter.export_metrics(mock_metrics, "tenant-1")
            PrometheusExporter.export_metrics(mock_metrics, "tenant-2")

            # Verify both tenants had metrics set
            assert mock_total.labels.call_count == 2
            mock_gauge1.set.assert_called_once()
            mock_gauge2.set.assert_called_once()

    def test_event_recording_workflow(self):
        """Test a complete event recording workflow."""
        with (
            patch(
                "dotmac.platform.monitoring.prometheus_exporter.subscriber_provisioned"
            ) as mock_prov,
            patch(
                "dotmac.platform.monitoring.prometheus_exporter.ip_allocation_success"
            ) as mock_alloc,
            patch("dotmac.platform.monitoring.prometheus_exporter.latency_histogram") as mock_lat,
        ):
            # Setup mocks
            for mock_metric in [mock_prov, mock_alloc, mock_lat]:
                mock_metric.labels.return_value = MagicMock()

            # Simulate provisioning a dual-stack subscriber
            PrometheusExporter.record_subscriber_provisioned("tenant-1", "dual_stack")
            PrometheusExporter.record_ip_allocation_success("tenant-1", "ipv4")
            PrometheusExporter.record_ip_allocation_success("tenant-1", "ipv6")
            PrometheusExporter.record_latency("tenant-1", "ipv4", 15.5)
            PrometheusExporter.record_latency("tenant-1", "ipv6", 14.2)

            # Verify all events were recorded
            assert mock_prov.labels.call_count == 1
            assert mock_alloc.labels.call_count == 2
            assert mock_lat.labels.call_count == 2
