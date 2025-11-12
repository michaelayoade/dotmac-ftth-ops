#!/bin/bash
# ============================================================================
# RADIUS Vendor Operations Monitor
#
# Monitors and reports on vendor-specific RADIUS operations in real-time.
# Useful for debugging and verifying vendor detection in production.
#
# Usage:
#   ./scripts/radius/monitor_vendor_operations.sh
#   ./scripts/radius/monitor_vendor_operations.sh --vendor cisco
#   ./scripts/radius/monitor_vendor_operations.sh --stats
# ============================================================================

set -euo pipefail

# Configuration
LOG_FILE="${LOG_FILE:-/var/log/dotmac/radius.log}"
STATS_INTERVAL=10  # seconds

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
VENDOR_FILTER=""
STATS_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --vendor)
            VENDOR_FILTER="$2"
            shift 2
            ;;
        --stats)
            STATS_MODE=true
            shift
            ;;
        --log-file)
            LOG_FILE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--vendor VENDOR] [--stats] [--log-file FILE]"
            exit 1
            ;;
    esac
done

# ============================================================================
# Statistics Mode
# ============================================================================

show_stats() {
    echo -e "${CYAN}RADIUS Vendor Statistics${NC}"
    echo "================================"
    echo "Sampling period: ${STATS_INTERVAL}s"
    echo ""

    # Get stats from logs (last 1000 lines)
    if [[ ! -f "$LOG_FILE" ]]; then
        echo -e "${RED}Log file not found: $LOG_FILE${NC}"
        return 1
    fi

    local SAMPLE=$(tail -n 1000 "$LOG_FILE")

    # Vendor distribution
    echo -e "${BLUE}Vendor Distribution:${NC}"
    echo "$SAMPLE" | grep -o 'vendor=[a-z]*' | cut -d= -f2 | sort | uniq -c | sort -rn | while read count vendor; do
        printf "  %-12s: %5d operations\n" "$vendor" "$count"
    done
    echo ""

    # Operation types
    echo -e "${BLUE}Operation Types:${NC}"
    echo "$SAMPLE" | grep -E '(bandwidth|disconnect|coa)' | grep -o 'radius_[a-z_]*' | sort | uniq -c | sort -rn | head -10 | while read count op; do
        printf "  %-30s: %5d\n" "$op" "$count"
    done
    echo ""

    # Success/failure rates
    echo -e "${BLUE}Success Rates:${NC}"
    local total=$(echo "$SAMPLE" | grep -c 'radius_' || true)
    local success=$(echo "$SAMPLE" | grep -c 'success.*true' || true)
    local failed=$(echo "$SAMPLE" | grep -c 'success.*false\|rejected\|failed' || true)

    if [[ $total -gt 0 ]]; then
        local success_rate=$(( success * 100 / total ))
        local failure_rate=$(( failed * 100 / total ))

        echo "  Total operations: $total"
        echo -e "  ${GREEN}Successful: $success ($success_rate%)${NC}"
        echo -e "  ${RED}Failed: $failed ($failure_rate%)${NC}"
    else
        echo "  No operations recorded"
    fi
    echo ""

    # Vendor-specific success rates
    echo -e "${BLUE}Per-Vendor Success Rates:${NC}"
    for vendor in mikrotik cisco huawei juniper; do
        local v_total=$(echo "$SAMPLE" | grep "vendor=$vendor" | wc -l)
        local v_success=$(echo "$SAMPLE" | grep "vendor=$vendor" | grep -c 'success.*true' || true)

        if [[ $v_total -gt 0 ]]; then
            local v_rate=$(( v_success * 100 / v_total ))
            printf "  %-12s: %3d%% (%d/%d)\n" "$vendor" "$v_rate" "$v_success" "$v_total"
        fi
    done
    echo ""
}

if [[ "$STATS_MODE" == true ]]; then
    while true; do
        clear
        show_stats
        sleep $STATS_INTERVAL
    done
    exit 0
fi

# ============================================================================
# Real-time Monitor Mode
# ============================================================================

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        RADIUS Vendor Operations Monitor                    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Log file: ${BLUE}$LOG_FILE${NC}"
if [[ -n "$VENDOR_FILTER" ]]; then
    echo -e "Filtering for vendor: ${YELLOW}$VENDOR_FILTER${NC}"
fi
echo ""
echo -e "${CYAN}Monitoring... (Press Ctrl+C to stop)${NC}"
echo "────────────────────────────────────────────────────────────"
echo ""

# Check if log file exists
if [[ ! -f "$LOG_FILE" ]]; then
    echo -e "${RED}Error: Log file not found: $LOG_FILE${NC}"
    echo "Please check your logging configuration."
    exit 1
fi

# Build grep filter
FILTER_CMD="cat"
if [[ -n "$VENDOR_FILTER" ]]; then
    FILTER_CMD="grep --line-buffered vendor=$VENDOR_FILTER"
fi

# Monitor logs
tail -f "$LOG_FILE" | $FILTER_CMD | while read -r line; do
    # Extract vendor if present
    vendor=$(echo "$line" | grep -o 'vendor=[a-z]*' | cut -d= -f2 || echo "unknown")

    # Color code by vendor
    case $vendor in
        mikrotik) COLOR=$GREEN ;;
        cisco)    COLOR=$BLUE ;;
        huawei)   COLOR=$YELLOW ;;
        juniper)  COLOR=$CYAN ;;
        *)        COLOR=$NC ;;
    esac

    # Extract operation
    if echo "$line" | grep -q 'bandwidth'; then
        operation="BANDWIDTH"
        op_color=$GREEN
    elif echo "$line" | grep -q 'disconnect'; then
        operation="DISCONNECT"
        op_color=$RED
    elif echo "$line" | grep -q 'coa'; then
        operation="COA"
        op_color=$YELLOW
    else
        operation="OTHER"
        op_color=$NC
    fi

    # Extract success/failure
    if echo "$line" | grep -q 'success.*true\|acknowledged'; then
        status="${GREEN}✓ SUCCESS${NC}"
    elif echo "$line" | grep -q 'success.*false\|rejected\|failed'; then
        status="${RED}✗ FAILED${NC}"
    else
        status="${YELLOW}⊘ INFO${NC}"
    fi

    # Extract timestamp
    timestamp=$(echo "$line" | grep -oP '\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}' | head -1 || echo "")

    # Extract username
    username=$(echo "$line" | grep -oP 'username=[^ ,}]*' | cut -d= -f2 || echo "")

    # Print formatted line
    if [[ -n "$timestamp" ]]; then
        echo -e "${timestamp} | ${COLOR}${vendor:0:8}${NC} | ${op_color}${operation:0:10}${NC} | $status | $username"
    fi
done
