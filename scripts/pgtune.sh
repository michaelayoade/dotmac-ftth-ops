#!/bin/bash
# scripts/pgtune.sh
# Generate PostgreSQL configuration using pgtune algorithm
# Based on: https://pgtune.leopard.in.ua/

set -e

# Parse arguments
TOTAL_RAM_MB=$1
DB_TYPE=${2:-web}
STORAGE_TYPE=${3:-ssd}

# Usage message
usage() {
    cat <<EOF
Usage: $0 <total_ram_mb> [db_type] [storage_type]

Arguments:
  total_ram_mb   Total RAM in megabytes (e.g., 4096 for 4GB)
  db_type        Database workload type (default: web)
                 - web: Web applications (balanced workload)
                 - oltp: Online Transaction Processing (many connections)
                 - dw: Data Warehouse (complex queries, fewer connections)
                 - desktop: Desktop applications
                 - mixed: Mixed workload
  storage_type   Storage type (default: ssd)
                 - ssd: Solid State Drive
                 - san: Storage Area Network
                 - hdd: Hard Disk Drive

Examples:
  $0 4096 web ssd          # 4GB RAM, web workload, SSD storage
  $0 16384 oltp ssd        # 16GB RAM, OLTP workload, SSD storage
  $0 32768 dw san          # 32GB RAM, data warehouse, SAN storage

Output:
  Creates .env.db file with PostgreSQL configuration
EOF
    exit 1
}

# Validate input
if [ -z "$TOTAL_RAM_MB" ]; then
    usage
fi

if ! [[ "$TOTAL_RAM_MB" =~ ^[0-9]+$ ]]; then
    echo "❌ Error: total_ram_mb must be a number"
    usage
fi

# Validate DB type
case $DB_TYPE in
    web|oltp|dw|desktop|mixed)
        ;;
    *)
        echo "❌ Error: Invalid db_type: $DB_TYPE"
        usage
        ;;
esac

# Validate storage type
case $STORAGE_TYPE in
    ssd|san|hdd)
        ;;
    *)
        echo "❌ Error: Invalid storage_type: $STORAGE_TYPE"
        usage
        ;;
esac

echo "🔧 Generating PostgreSQL configuration..."
echo "   RAM: ${TOTAL_RAM_MB}MB"
echo "   Workload: $DB_TYPE"
echo "   Storage: $STORAGE_TYPE"
echo ""

# Calculate shared buffers (25% of RAM, max 8GB for most workloads)
SHARED_BUFFERS=$((TOTAL_RAM_MB / 4))
if [ $SHARED_BUFFERS -gt 8192 ]; then
    SHARED_BUFFERS=8192
fi

# Calculate effective cache size (50-75% of RAM depending on workload)
case $DB_TYPE in
    web|mixed)
        EFFECTIVE_CACHE=$((TOTAL_RAM_MB * 3 / 4))  # 75%
        ;;
    oltp)
        EFFECTIVE_CACHE=$((TOTAL_RAM_MB * 3 / 4))  # 75%
        ;;
    dw)
        EFFECTIVE_CACHE=$((TOTAL_RAM_MB * 3 / 4))  # 75%
        ;;
    desktop)
        EFFECTIVE_CACHE=$((TOTAL_RAM_MB / 4))      # 25%
        ;;
esac

# Calculate max connections based on workload
case $DB_TYPE in
    web)
        MAX_CONNECTIONS=200
        ;;
    oltp)
        MAX_CONNECTIONS=300
        ;;
    dw)
        MAX_CONNECTIONS=40
        ;;
    desktop)
        MAX_CONNECTIONS=20
        ;;
    mixed)
        MAX_CONNECTIONS=100
        ;;
esac

# Calculate work mem
WORK_MEM=$((TOTAL_RAM_MB / MAX_CONNECTIONS / 4))
if [ $WORK_MEM -lt 4 ]; then
    WORK_MEM=4
fi

# Calculate maintenance work mem
MAINTENANCE_WORK_MEM=$((TOTAL_RAM_MB / 16))
if [ $MAINTENANCE_WORK_MEM -lt 64 ]; then
    MAINTENANCE_WORK_MEM=64
fi
if [ $MAINTENANCE_WORK_MEM -gt 2048 ]; then
    MAINTENANCE_WORK_MEM=2048
fi

# Random page cost varies by storage type
case $STORAGE_TYPE in
    ssd)
        RANDOM_PAGE_COST=1.1
        EFFECTIVE_IO_CONCURRENCY=200
        ;;
    san)
        RANDOM_PAGE_COST=1.1
        EFFECTIVE_IO_CONCURRENCY=300
        ;;
    hdd)
        RANDOM_PAGE_COST=4.0
        EFFECTIVE_IO_CONCURRENCY=2
        ;;
esac

# Min/Max WAL size based on RAM
if [ $TOTAL_RAM_MB -lt 4096 ]; then
    # Less than 4GB RAM
    MIN_WAL_SIZE=512
    MAX_WAL_SIZE=2048
elif [ $TOTAL_RAM_MB -lt 16384 ]; then
    # 4-16GB RAM
    MIN_WAL_SIZE=1024
    MAX_WAL_SIZE=4096
else
    # 16GB+ RAM
    MIN_WAL_SIZE=2048
    MAX_WAL_SIZE=8192
fi

# Output configuration
OUTPUT_FILE=".env.db"

cat > "$OUTPUT_FILE" <<EOF
# PostgreSQL Configuration (pgtune algorithm)
# Generated: $(date)
# RAM: ${TOTAL_RAM_MB}MB
# Workload: $DB_TYPE
# Storage: $STORAGE_TYPE

# Memory Configuration
DB_SHARED_BUFFERS=${SHARED_BUFFERS}MB
DB_CACHE_SIZE=${EFFECTIVE_CACHE}MB
DB_WORK_MEM=${WORK_MEM}MB
DB_MAINTENANCE_WORK_MEM=${MAINTENANCE_WORK_MEM}MB

# Connection Configuration
DB_MAX_CONNECTIONS=${MAX_CONNECTIONS}

# WAL Configuration
DB_MIN_WAL_SIZE=${MIN_WAL_SIZE}MB
DB_MAX_WAL_SIZE=${MAX_WAL_SIZE}MB
DB_WAL_BUFFERS=16MB
DB_CHECKPOINT_COMPLETION_TARGET=0.9

# Query Planner Configuration
DB_RANDOM_PAGE_COST=${RANDOM_PAGE_COST}
DB_EFFECTIVE_IO_CONCURRENCY=${EFFECTIVE_IO_CONCURRENCY}

# Parallel Query Configuration
DB_MAX_WORKER_PROCESSES=8
DB_MAX_PARALLEL_WORKERS_PER_GATHER=4
DB_MAX_PARALLEL_WORKERS=8
DB_MAX_PARALLEL_MAINTENANCE_WORKERS=4
EOF

echo "✅ Configuration written to: $OUTPUT_FILE"
echo ""
echo "📋 Summary:"
echo "   Shared Buffers:       ${SHARED_BUFFERS}MB"
echo "   Effective Cache:      ${EFFECTIVE_CACHE}MB"
echo "   Max Connections:      ${MAX_CONNECTIONS}"
echo "   Work Mem:             ${WORK_MEM}MB"
echo "   Random Page Cost:     ${RANDOM_PAGE_COST}"
echo "   I/O Concurrency:      ${EFFECTIVE_IO_CONCURRENCY}"
echo ""
echo "💡 Usage:"
echo "   docker-compose --env-file .env --env-file .env.db up postgres"
