#!/usr/bin/env python3
"""
Fix all TS4111 'Property comes from an index signature' errors
by converting dot notation to bracket notation.
"""

import re
import sys
from pathlib import Path

def fix_ts4111_in_file(file_path: Path) -> bool:
    """
    Fix TS4111 errors in a single file by converting dot notation to bracket notation.
    Returns True if file was modified, False otherwise.
    """
    try:
        content = file_path.read_text()
        original_content = content

        # Common patterns to fix - order matters!
        # Pattern: obj.property -> obj['property']
        # Pattern: obj?.property -> obj?.['property']

        # List of common object names that trigger TS4111 errors
        # We'll use a more comprehensive regex approach

        # Pattern 1: errors.propertyName -> errors['propertyName']
        # Pattern 2: formData.propertyName -> formData['propertyName']
        # Pattern 3: metadata.propertyName -> metadata['propertyName']
        # etc.

        # More generic approach: Find instances where we access properties with dot notation
        # on objects that come from index signatures

        # Common object names from the codebase
        object_names = [
            'errors', 'formData', 'metadata', 'response', 'config',
            'options', 'params', 'query', 'body', 'headers', 'data',
            'result', 'item', 'value', 'obj', 'row', 'record', 'entity',
            'metrics', 'stats', 'info', 'details', 'settings', 'props',
            'state', 'context', 'event', 'payload', 'attributes', 'values',
            'fields', 'schema', 'form', 'input', 'output', 'request',
            'args', 'opts', 'cfg', 'env', 'variables', 'parameters',
            'topology', 'device', 'status', 'alarm', 'performance',
            'onu', 'ont', 'olt', 'port', 'vlan', 'subscriber', 'customer',
            'service', 'plan', 'billing', 'invoice', 'payment', 'transaction',
            'template', 'plugin', 'addon', 'method', 'provider', 'channel',
            'notification', 'message', 'alert', 'log', 'entry', 'activity',
            'session', 'token', 'auth', 'user', 'role', 'permission',
            'network', 'router', 'switch', 'interface', 'address', 'pool',
            'allocation', 'reservation', 'lease', 'dhcp', 'dns', 'ipam',
            'server', 'client', 'peer', 'connection', 'tunnel', 'vpn',
            'wireguard', 'endpoint', 'publicKey', 'privateKey', 'presharedKey',
            'firmware', 'version', 'update', 'upgrade', 'patch', 'release',
            'task', 'job', 'queue', 'worker', 'process', 'thread',
            'cache', 'store', 'db', 'database', 'collection', 'document',
            'filter', 'sort', 'pagination', 'limit', 'offset', 'cursor',
            'validation', 'error', 'warning', 'info', 'debug', 'trace',
            'component', 'widget', 'element', 'node', 'tree', 'graph',
            'chart', 'diagram', 'map', 'layer', 'marker', 'popup',
            'feature', 'property', 'attribute', 'field', 'column', 'cell',
            'row', 'table', 'grid', 'list', 'array', 'set', 'map',
            'parsedData', 'responseData', 'requestData', 'formValues',
            'queryParams', 'routeParams', 'pathParams', 'searchParams',
            'defaultValues', 'initialValues', 'currentValues', 'newValues',
            'oldValues', 'updatedValues', 'changedValues', 'dirtyValues',
            'deviceInfo', 'deviceData', 'deviceConfig', 'deviceStatus',
            'alarmData', 'performanceData', 'topologyData', 'metricsData',
            'statsData', 'healthData', 'diagnosticData', 'testData',
            'onuInfo', 'ontInfo', 'oltInfo', 'portInfo', 'vlanInfo',
            'subscriberInfo', 'customerInfo', 'accountInfo', 'profileInfo',
            'planInfo', 'serviceInfo', 'packageInfo', 'bundleInfo',
            'pluginConfig', 'pluginSettings', 'pluginMetadata', 'pluginInfo',
            'templateData', 'templateConfig', 'templateSettings', 'templateVars',
            'billingData', 'paymentData', 'invoiceData', 'transactionData',
            'addonData', 'addonConfig', 'addonSettings', 'addonInfo',
            'methodData', 'providerData', 'channelData', 'gatewayData',
            'notificationData', 'messageData', 'alertData', 'logData',
            'entryData', 'activityData', 'eventData', 'historyData',
            'sessionData', 'tokenData', 'authData', 'userData',
            'roleData', 'permissionData', 'accessData', 'rightsData',
            'networkData', 'routerData', 'switchData', 'interfaceData',
            'addressData', 'poolData', 'allocationData', 'reservationData',
            'leaseData', 'dhcpData', 'dnsData', 'ipamData',
            'serverData', 'clientData', 'peerData', 'connectionData',
            'tunnelData', 'vpnData', 'wireguardData', 'endpointData',
            'firmwareData', 'versionData', 'updateData', 'upgradeData',
            'taskData', 'jobData', 'queueData', 'workflowData',
            'cacheData', 'storeData', 'dbData', 'databaseData',
            'filterData', 'sortData', 'paginationData', 'searchData',
            'validationData', 'errorData', 'warningData', 'infoData',
            'componentData', 'widgetData', 'elementData', 'nodeData',
            'chartData', 'diagramData', 'mapData', 'layerData',
            'featureData', 'propertyData', 'attributeData', 'fieldData',
        ]

        # Build regex pattern for all object names
        # Match: objectName.propertyName (but not in strings or comments)
        # Also match: objectName?.propertyName

        for obj_name in object_names:
            # Pattern 1: obj.propertyName -> obj['propertyName']
            # Only match if followed by identifier characters (property name)
            # Negative lookbehind to avoid matching if already in bracket notation
            pattern1 = rf'\b({re.escape(obj_name)})\.([a-zA-Z_$][a-zA-Z0-9_$]*)\b(?!\s*[=\(])'
            replacement1 = r"\1['\2']"
            content = re.sub(pattern1, replacement1, content)

            # Pattern 2: obj?.propertyName -> obj?.['propertyName']
            pattern2 = rf'\b({re.escape(obj_name)})\?\.\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\b(?!\s*[=\(])'
            replacement2 = r"\1?.['\2']"
            content = re.sub(pattern2, replacement2, content)

        # Additional specific patterns for common cases

        # Fix: errors.fieldName when errors is from form validation
        content = re.sub(r'\berrors\.([a-zA-Z_$][a-zA-Z0-9_$]*)', r"errors['\1']", content)
        content = re.sub(r'\berrors\?\.\s*([a-zA-Z_$][a-zA-Z0-9_$]*)', r"errors?.['\1']", content)

        # Fix: formData.fieldName
        content = re.sub(r'\bformData\.([a-zA-Z_$][a-zA-Z0-9_$]*)', r"formData['\1']", content)
        content = re.sub(r'\bformData\?\.\s*([a-zA-Z_$][a-zA-Z0-9_$]*)', r"formData?.['\1']", content)

        # Fix: metadata.fieldName
        content = re.sub(r'\bmetadata\.([a-zA-Z_$][a-zA-Z0-9_$]*)', r"metadata['\1']", content)
        content = re.sub(r'\bmetadata\?\.\s*([a-zA-Z_$][a-zA-Z0-9_$]*)', r"metadata?.['\1']", content)

        # Fix common patterns in hooks and services
        content = re.sub(r'\bmetrics\.([a-zA-Z_$][a-zA-Z0-9_$]*)', r"metrics['\1']", content)
        content = re.sub(r'\bmetrics\?\.\s*([a-zA-Z_$][a-zA-Z0-9_$]*)', r"metrics?.['\1']", content)

        if content != original_content:
            file_path.write_text(content)
            return True
        return False

    except Exception as e:
        print(f"Error processing {file_path}: {e}", file=sys.stderr)
        return False

def main():
    # Base directory for isp-ops-app
    base_dir = Path("/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/isp-ops-app")

    # List of files with TS4111 errors (from grep output)
    files_to_fix = [
        "app/dashboard/communications/templates/new/page.tsx",
        "app/dashboard/diagnostics/page.tsx",
        "app/dashboard/diagnostics/runs/[runId]/page.tsx",
        "app/dashboard/infrastructure/logs/page.tsx",
        "app/dashboard/network/wireguard/peers/[id]/edit/page.tsx",
        "app/dashboard/network/wireguard/peers/new/page.tsx",
        "app/dashboard/network/wireguard/provision/page.tsx",
        "app/dashboard/network/wireguard/servers/[id]/edit/page.tsx",
        "app/dashboard/network/wireguard/servers/new/page.tsx",
        "app/dashboard/pon/olts/[oltId]/page.tsx",
        "app/dashboard/pon/olts/page.tsx",
        "app/dashboard/pon/onus/[onuId]/page.tsx",
        "app/dashboard/pon/onus/discover/page.tsx",
        "app/dashboard/pon/onus/page.tsx",
        "app/dashboard/settings/plugins/components/PluginForm.tsx",
        "app/dashboard/settings/plugins/components/PluginHealthDashboard.tsx",
        "components/genieacs/BulkOperationsDashboard.tsx",
        "components/genieacs/CPEConfigTemplates.tsx",
        "components/genieacs/DeviceManagement.tsx",
        "components/genieacs/FirmwareManagement.tsx",
        "components/ipam/EditIPPoolModal.tsx",
        "components/network/NetworkProfileStats.tsx",
        "components/subscribers/NetworkProfileCard.tsx",
        "components/subscribers/NetworkProfileEditDialog.tsx",
        "components/tenant/billing/ActiveAddonCard.tsx",
        "components/tenant/billing/AddonCard.tsx",
        "components/tenant/billing/PaymentMethodCard.tsx",
        "components/voltha/AlarmPerformanceMonitoring.tsx",
        "components/voltha/ONUProvisioningWorkflow.tsx",
        "hooks/useCustomers.ts",
        "hooks/useOrchestration.ts",
        "hooks/useRADIUS.ts",
        "hooks/useServiceLifecycle.ts",
        "hooks/useTicketing.ts",
        "hooks/useWebhooks.ts",
        "lib/api/client.ts",
        "lib/error-handler.ts",
        "lib/graphql/client.ts",
        "lib/pwa.ts",
        "lib/services/metrics-service.ts",
    ]

    modified_count = 0

    for file_rel_path in files_to_fix:
        file_path = base_dir / file_rel_path
        if not file_path.exists():
            print(f"Warning: File not found: {file_path}", file=sys.stderr)
            continue

        print(f"Processing: {file_rel_path}")
        if fix_ts4111_in_file(file_path):
            modified_count += 1
            print(f"  ✓ Modified")
        else:
            print(f"  - No changes needed")

    print(f"\n{'='*60}")
    print(f"Total files processed: {len(files_to_fix)}")
    print(f"Total files modified: {modified_count}")
    print(f"{'='*60}")

    return 0

if __name__ == "__main__":
    sys.exit(main())
