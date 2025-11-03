"""Add wireless infrastructure tables

Revision ID: 7f8e9d0a1b2c
Revises: 65962d3cc9b6
Create Date: 2025-10-16 06:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '7f8e9d0a1b2c'
down_revision: str | None = '65962d3cc9b6'
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    # Note: All enums already exist from network_monitoring module, skip creation
    pass

    # Create wireless_devices table
    op.create_table('wireless_devices',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('device_type', sa.Enum('access_point', 'radio', 'antenna', 'cpe', 'backhaul', 'tower', name='devicetype'), nullable=False),
        sa.Column('status', sa.Enum('online', 'offline', 'degraded', 'maintenance', 'decommissioned', name='devicestatus'), nullable=False),
        sa.Column('manufacturer', sa.String(length=100), nullable=True),
        sa.Column('model', sa.String(length=100), nullable=True),
        sa.Column('serial_number', sa.String(length=100), nullable=True),
        sa.Column('mac_address', sa.String(length=17), nullable=True),
        sa.Column('firmware_version', sa.String(length=50), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('management_url', sa.String(length=255), nullable=True),
        sa.Column('ssid', sa.String(length=32), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('altitude_meters', sa.Float(), nullable=True),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('site_name', sa.String(length=255), nullable=True),
        sa.Column('tower_height_meters', sa.Float(), nullable=True),
        sa.Column('mounting_height_meters', sa.Float(), nullable=True),
        sa.Column('azimuth_degrees', sa.Float(), nullable=True),
        sa.Column('tilt_degrees', sa.Float(), nullable=True),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=True),
        sa.Column('uptime_seconds', sa.Integer(), nullable=True),
        sa.Column('netbox_device_id', sa.Integer(), nullable=True),
        sa.Column('external_id', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('extra_metadata', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('tags', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=255), nullable=True),
        sa.Column('updated_by', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('serial_number')
    )
    op.create_index('ix_wireless_devices_device_type', 'wireless_devices', ['device_type'])
    op.create_index('ix_wireless_devices_location', 'wireless_devices', ['latitude', 'longitude'])
    op.create_index('ix_wireless_devices_mac_address', 'wireless_devices', ['mac_address'])
    op.create_index('ix_wireless_devices_site_name', 'wireless_devices', ['site_name'])
    op.create_index('ix_wireless_devices_status', 'wireless_devices', ['status'])
    op.create_index('ix_wireless_devices_tenant_id', 'wireless_devices', ['tenant_id'])
    op.create_index('ix_wireless_devices_tenant_status', 'wireless_devices', ['tenant_id', 'status'])
    op.create_index('ix_wireless_devices_tenant_type', 'wireless_devices', ['tenant_id', 'device_type'])

    # Create wireless_radios table
    op.create_table('wireless_radios',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', sa.String(length=255), nullable=False),
        sa.Column('device_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('radio_name', sa.String(length=100), nullable=False),
        sa.Column('radio_index', sa.Integer(), nullable=False),
        sa.Column('frequency', sa.Enum('2.4GHz', '5GHz', '6GHz', '60GHz', 'custom', name='frequency'), nullable=False),
        sa.Column('protocol', sa.Enum('802.11n', '802.11ac', '802.11ax', '802.11ax_6ghz', '802.11be', 'wimax', 'lte', 'custom', name='radioprotocol'), nullable=False),
        sa.Column('channel', sa.Integer(), nullable=True),
        sa.Column('channel_width_mhz', sa.Integer(), nullable=True),
        sa.Column('transmit_power_dbm', sa.Float(), nullable=True),
        sa.Column('max_power_dbm', sa.Float(), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('status', sa.Enum('online', 'offline', 'degraded', 'maintenance', 'decommissioned', name='devicestatus'), nullable=False),
        sa.Column('noise_floor_dbm', sa.Float(), nullable=True),
        sa.Column('interference_level', sa.Float(), nullable=True),
        sa.Column('utilization_percent', sa.Float(), nullable=True),
        sa.Column('connected_clients', sa.Integer(), nullable=False),
        sa.Column('tx_bytes', sa.Integer(), nullable=False),
        sa.Column('rx_bytes', sa.Integer(), nullable=False),
        sa.Column('tx_packets', sa.Integer(), nullable=False),
        sa.Column('rx_packets', sa.Integer(), nullable=False),
        sa.Column('errors', sa.Integer(), nullable=False),
        sa.Column('retries', sa.Integer(), nullable=False),
        sa.Column('extra_metadata', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['device_id'], ['wireless_devices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_wireless_radios_device_id', 'wireless_radios', ['device_id'])
    op.create_index('ix_wireless_radios_frequency', 'wireless_radios', ['frequency'])
    op.create_index('ix_wireless_radios_tenant_device', 'wireless_radios', ['tenant_id', 'device_id'])
    op.create_index('ix_wireless_radios_tenant_id', 'wireless_radios', ['tenant_id'])

    # Create wireless_coverage_zones table
    op.create_table('wireless_coverage_zones',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', sa.String(length=255), nullable=False),
        sa.Column('device_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('zone_name', sa.String(length=255), nullable=False),
        sa.Column('coverage_type', sa.Enum('primary', 'secondary', 'dead_zone', 'interference', name='coveragetype'), nullable=False),
        sa.Column('geometry', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('center_latitude', sa.Float(), nullable=True),
        sa.Column('center_longitude', sa.Float(), nullable=True),
        sa.Column('estimated_signal_strength_dbm', sa.Float(), nullable=True),
        sa.Column('coverage_radius_meters', sa.Float(), nullable=True),
        sa.Column('frequency', sa.Enum('2.4GHz', '5GHz', '6GHz', '60GHz', 'custom', name='frequency'), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('extra_metadata', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['device_id'], ['wireless_devices.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_coverage_zones_center', 'wireless_coverage_zones', ['center_latitude', 'center_longitude'])
    op.create_index('ix_coverage_zones_tenant_type', 'wireless_coverage_zones', ['tenant_id', 'coverage_type'])
    op.create_index('ix_wireless_coverage_zones_device_id', 'wireless_coverage_zones', ['device_id'])
    op.create_index('ix_wireless_coverage_zones_tenant_id', 'wireless_coverage_zones', ['tenant_id'])

    # Create wireless_signal_measurements table
    op.create_table('wireless_signal_measurements',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', sa.String(length=255), nullable=False),
        sa.Column('device_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('measured_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('rssi_dbm', sa.Float(), nullable=True),
        sa.Column('snr_db', sa.Float(), nullable=True),
        sa.Column('noise_floor_dbm', sa.Float(), nullable=True),
        sa.Column('link_quality_percent', sa.Float(), nullable=True),
        sa.Column('throughput_mbps', sa.Float(), nullable=True),
        sa.Column('latency_ms', sa.Float(), nullable=True),
        sa.Column('packet_loss_percent', sa.Float(), nullable=True),
        sa.Column('jitter_ms', sa.Float(), nullable=True),
        sa.Column('frequency', sa.Enum('2.4GHz', '5GHz', '6GHz', '60GHz', 'custom', name='frequency'), nullable=True),
        sa.Column('channel', sa.Integer(), nullable=True),
        sa.Column('client_mac', sa.String(length=17), nullable=True),
        sa.Column('measurement_type', sa.String(length=50), nullable=True),
        sa.Column('extra_metadata', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['device_id'], ['wireless_devices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_signal_measurements_location', 'wireless_signal_measurements', ['latitude', 'longitude'])
    op.create_index('ix_signal_measurements_measured_at', 'wireless_signal_measurements', ['measured_at'])
    op.create_index('ix_signal_measurements_tenant_device', 'wireless_signal_measurements', ['tenant_id', 'device_id'])
    op.create_index('ix_wireless_signal_measurements_device_id', 'wireless_signal_measurements', ['device_id'])
    op.create_index('ix_wireless_signal_measurements_tenant_id', 'wireless_signal_measurements', ['tenant_id'])

    # Create wireless_clients table
    op.create_table('wireless_clients',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', sa.String(length=255), nullable=False),
        sa.Column('device_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('mac_address', sa.String(length=17), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('hostname', sa.String(length=255), nullable=True),
        sa.Column('ssid', sa.String(length=32), nullable=True),
        sa.Column('frequency', sa.Enum('2.4GHz', '5GHz', '6GHz', '60GHz', 'custom', name='frequency'), nullable=True),
        sa.Column('channel', sa.Integer(), nullable=True),
        sa.Column('connected', sa.Boolean(), nullable=False),
        sa.Column('first_seen', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=False),
        sa.Column('connection_duration_seconds', sa.Integer(), nullable=True),
        sa.Column('rssi_dbm', sa.Float(), nullable=True),
        sa.Column('snr_db', sa.Float(), nullable=True),
        sa.Column('tx_rate_mbps', sa.Float(), nullable=True),
        sa.Column('rx_rate_mbps', sa.Float(), nullable=True),
        sa.Column('tx_bytes', sa.Integer(), nullable=False),
        sa.Column('rx_bytes', sa.Integer(), nullable=False),
        sa.Column('tx_packets', sa.Integer(), nullable=False),
        sa.Column('rx_packets', sa.Integer(), nullable=False),
        sa.Column('vendor', sa.String(length=255), nullable=True),
        sa.Column('device_type', sa.String(length=100), nullable=True),
        sa.Column('subscriber_id', sa.String(length=255), nullable=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('extra_metadata', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['device_id'], ['wireless_devices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_wireless_clients_connected', 'wireless_clients', ['connected', 'last_seen'])
    op.create_index('ix_wireless_clients_mac', 'wireless_clients', ['mac_address'])
    op.create_index('ix_wireless_clients_mac_address', 'wireless_clients', ['mac_address'])
    op.create_index('ix_wireless_clients_subscriber_id', 'wireless_clients', ['subscriber_id'])
    op.create_index('ix_wireless_clients_tenant_device', 'wireless_clients', ['tenant_id', 'device_id'])
    op.create_index('ix_wireless_clients_tenant_id', 'wireless_clients', ['tenant_id'])
    op.create_index('ix_wireless_clients_connected_idx', 'wireless_clients', ['connected'])


def downgrade() -> None:
    # Drop tables
    op.drop_table('wireless_clients')
    op.drop_table('wireless_signal_measurements')
    op.drop_table('wireless_coverage_zones')
    op.drop_table('wireless_radios')
    op.drop_table('wireless_devices')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS coveragetype')
    op.execute('DROP TYPE IF EXISTS radioprotocol')
    op.execute('DROP TYPE IF EXISTS frequency')
    op.execute('DROP TYPE IF EXISTS devicestatus')
    op.execute('DROP TYPE IF EXISTS devicetype')
