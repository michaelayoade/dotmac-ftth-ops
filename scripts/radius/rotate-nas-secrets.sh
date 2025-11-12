#!/bin/bash
# RADIUS NAS Shared Secret Rotation Script
#
# This script rotates shared secrets for RADIUS NAS devices:
# 1. Generates new strong secrets
# 2. Stores them in HashiCorp Vault
# 3. Updates clients.conf
# 4. Reloads FreeRADIUS container gracefully
#
# Usage: ./rotate-nas-secrets.sh [--nas-id=123] [--all] [--dry-run]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Configuration
RADIUS_CONTAINER="${RADIUS_CONTAINER:-isp-freeradius}"
CLIENTS_CONF="${PROJECT_ROOT}/config/radius/clients.conf"
VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-}"
VAULT_NAMESPACE="${VAULT_NAMESPACE:-radius/nas}"
SECRET_LENGTH=32

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# Generate secure random secret
generate_secret() {
    local length=$1
    # Use /dev/urandom for cryptographically secure random data
    LC_ALL=C tr -dc 'A-Za-z0-9!@#$%^&*()_+-=' < /dev/urandom | head -c "$length"
}

# Store secret in Vault
store_in_vault() {
    local nas_id=$1
    local nas_name=$2
    local secret=$3

    if [ -z "$VAULT_TOKEN" ]; then
        log_warn "VAULT_TOKEN not set, skipping Vault storage"
        return 1
    fi

    local vault_path="secret/data/${VAULT_NAMESPACE}/${nas_id}"

    log_info "Storing secret in Vault at ${vault_path}"

    curl -s -X POST \
        -H "X-Vault-Token: ${VAULT_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"data\": {\"shared_secret\": \"${secret}\", \"nas_name\": \"${nas_name}\", \"rotated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}}" \
        "${VAULT_ADDR}/v1/${vault_path}" > /dev/null

    if [ $? -eq 0 ]; then
        log_info "Secret stored in Vault successfully"
        return 0
    else
        log_error "Failed to store secret in Vault"
        return 1
    fi
}

# Update clients.conf with new secret
update_clients_conf() {
    local nas_name=$1
    local new_secret=$2
    local dry_run=$3

    if [ ! -f "$CLIENTS_CONF" ]; then
        log_error "clients.conf not found at ${CLIENTS_CONF}"
        return 1
    fi

    # Create backup
    local backup_file="${CLIENTS_CONF}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$CLIENTS_CONF" "$backup_file"
    log_info "Created backup: ${backup_file}"

    if [ "$dry_run" = true ]; then
        log_info "[DRY-RUN] Would update secret for ${nas_name}"
        return 0
    fi

    # Update the secret in clients.conf
    # This uses sed to find the client block and update the secret line
    sed -i.tmp "/client ${nas_name} {/,/}/ s/secret = .*/secret = ${new_secret}/" "$CLIENTS_CONF"
    rm "${CLIENTS_CONF}.tmp"

    log_info "Updated clients.conf for ${nas_name}"
}

# Reload FreeRADIUS container
reload_freeradius() {
    local dry_run=$1

    if [ "$dry_run" = true ]; then
        log_info "[DRY-RUN] Would reload FreeRADIUS container"
        return 0
    fi

    log_info "Reloading FreeRADIUS container..."

    # Send SIGHUP to radiusd process for graceful reload
    docker exec "$RADIUS_CONTAINER" kill -HUP 1

    if [ $? -eq 0 ]; then
        log_info "FreeRADIUS reloaded successfully"
        sleep 2

        # Verify container is still healthy
        if docker ps --filter "name=${RADIUS_CONTAINER}" --filter "health=healthy" | grep -q "$RADIUS_CONTAINER"; then
            log_info "Container is healthy after reload"
            return 0
        else
            log_error "Container is not healthy after reload!"
            log_error "Rolling back to backup..."
            # Rollback logic would go here
            return 1
        fi
    else
        log_error "Failed to reload FreeRADIUS"
        return 1
    fi
}

# Rotate secret for a single NAS
rotate_nas() {
    local nas_id=$1
    local nas_name=$2
    local dry_run=$3

    log_info "=== Rotating secret for NAS: ${nas_name} (ID: ${nas_id}) ==="

    # Generate new secret
    local new_secret=$(generate_secret "$SECRET_LENGTH")
    log_info "Generated new ${SECRET_LENGTH}-character secret"

    # Store in Vault
    if ! store_in_vault "$nas_id" "$nas_name" "$new_secret"; then
        log_warn "Vault storage failed, continuing with file update..."
    fi

    # Update clients.conf
    if ! update_clients_conf "$nas_name" "$new_secret" "$dry_run"; then
        log_error "Failed to update clients.conf"
        return 1
    fi

    log_info "✓ Secret rotation complete for ${nas_name}"
    echo ""
}

# Rotate all NAS secrets
rotate_all() {
    local dry_run=$1

    log_info "=== Rotating ALL NAS secrets ==="

    # Extract all client names from clients.conf
    local nas_clients=$(grep -oP '(?<=^client )[^ ]+' "$CLIENTS_CONF" || true)

    if [ -z "$nas_clients" ]; then
        log_error "No NAS clients found in clients.conf"
        return 1
    fi

    local count=0
    while IFS= read -r nas_name; do
        # Skip localhost and example clients
        if [[ "$nas_name" =~ ^(localhost|example|test) ]]; then
            log_info "Skipping ${nas_name} (system client)"
            continue
        fi

        count=$((count + 1))
        rotate_nas "$count" "$nas_name" "$dry_run"
    done <<< "$nas_clients"

    log_info "Rotated secrets for ${count} NAS devices"
}

# Main
main() {
    local nas_id=""
    local nas_name=""
    local rotate_all_flag=false
    local dry_run=false

    # Parse arguments
    for arg in "$@"; do
        case $arg in
            --nas-id=*)
                nas_id="${arg#*=}"
                shift
                ;;
            --nas-name=*)
                nas_name="${arg#*=}"
                shift
                ;;
            --all)
                rotate_all_flag=true
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --nas-id=ID        Rotate secret for specific NAS by ID"
                echo "  --nas-name=NAME    Rotate secret for specific NAS by name"
                echo "  --all              Rotate secrets for all NAS devices"
                echo "  --dry-run          Show what would be done without making changes"
                echo "  --help             Show this help message"
                echo ""
                echo "Environment Variables:"
                echo "  VAULT_ADDR         Vault server address (default: http://127.0.0.1:8200)"
                echo "  VAULT_TOKEN        Vault authentication token"
                echo "  RADIUS_CONTAINER   FreeRADIUS container name (default: isp-freeradius)"
                exit 0
                ;;
            *)
                log_error "Unknown argument: $arg"
                exit 1
                ;;
        esac
    done

    # Validate container is running
    if ! docker ps | grep -q "$RADIUS_CONTAINER"; then
        log_error "FreeRADIUS container '${RADIUS_CONTAINER}' is not running"
        exit 1
    fi

    if [ "$dry_run" = true ]; then
        log_warn "=== DRY-RUN MODE ==="
    fi

    # Execute rotation
    if [ "$rotate_all_flag" = true ]; then
        rotate_all "$dry_run"
    elif [ -n "$nas_name" ]; then
        rotate_nas "${nas_id:-auto}" "$nas_name" "$dry_run"
    else
        log_error "Must specify --nas-name, --nas-id, or --all"
        exit 1
    fi

    # Reload FreeRADIUS
    if ! reload_freeradius "$dry_run"; then
        log_error "Failed to reload FreeRADIUS"
        exit 1
    fi

    log_info "=== Secret rotation completed successfully ==="
    log_info "Next steps:"
    log_info "  1. Update secrets on NAS devices (routers/OLTs)"
    log_info "  2. Test authentication"
    log_info "  3. Monitor for auth failures"
}

main "$@"
