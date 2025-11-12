#!/bin/sh
# Alertmanager entrypoint script
# Expands environment variables in config file before starting Alertmanager

set -e

# Check if ALERTMANAGER_WEBHOOK_SECRET is set
if [ -z "$ALERTMANAGER_WEBHOOK_SECRET" ]; then
    echo "ERROR: ALERTMANAGER_WEBHOOK_SECRET is not set!"
    echo "Generate a secret with: openssl rand -base64 32"
    exit 1
fi

# Provide a sensible default for the webhook URL if not supplied
: "${ALERTMANAGER_WEBHOOK_URL:=http://app:8000/api/v1/monitoring/alerts/webhook}"
export ALERTMANAGER_WEBHOOK_URL

# Expand environment variables in config file
envsubst < /etc/alertmanager/alertmanager.yml > /tmp/alertmanager.yml

# Start Alertmanager with the processed config
exec /bin/alertmanager --config.file=/tmp/alertmanager.yml "$@"
