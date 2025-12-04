#!/bin/bash
# scripts/validate-docker-compose-env.sh
# Validates that all required files and directories exist for Docker Compose deployment

set -e

echo "🔍 Validating Docker Compose environment..."
echo ""

# Required directories
REQUIRED_DIRS=(
    "config/radius"
    "config/awx"
    "monitoring/prometheus"
    "monitoring/grafana/dashboards"
    "database/init"
)

# Required files
REQUIRED_FILES=(
    "config/radius/clients.conf"
    "config/radius/dictionary"
    "config/awx/settings.py"
    "monitoring/prometheus/prometheus.yml"
    "monitoring/prometheus/alertmanager.yml"
)

MISSING_DIRS=()
MISSING_FILES=()
WARNINGS=()

# Check directories
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        MISSING_DIRS+=("$dir")
    fi
done

# Check files
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

# Check for environment file
if [ ! -f ".env" ]; then
    WARNINGS+=(".env file not found - using defaults")
fi

# Report findings
if [ ${#MISSING_DIRS[@]} -gt 0 ]; then
    echo "❌ Missing required directories:"
    printf '  - %s\n' "${MISSING_DIRS[@]}"
    echo ""
fi

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo "❌ Missing required files:"
    printf '  - %s\n' "${MISSING_FILES[@]}"
    echo ""
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo "⚠️  Warnings:"
    printf '  - %s\n' "${WARNINGS[@]}"
    echo ""
fi

if [ ${#MISSING_DIRS[@]} -gt 0 ] || [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo "💡 Run the following command to create missing files:"
    echo "   ./scripts/setup-config-files.sh"
    echo ""
    exit 1
fi

echo "✅ All required files and directories exist"
echo "✅ Environment validation passed"
exit 0
