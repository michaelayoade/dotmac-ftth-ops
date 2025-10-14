#!/bin/bash
set -e

# Production entrypoint script for DotMac Platform Celery
# Handles pre-start checks and worker/beat startup

echo "Starting DotMac Platform Celery..."

# Function to wait for service
wait_for_service() {
    local host="$1"
    local port="$2"
    local service_name="$3"
    local max_attempts="${4:-30}"
    local attempt=1

    echo "Waiting for $service_name at $host:$port..."

    while [ $attempt -le $max_attempts ]; do
        if nc -z "$host" "$port" 2>/dev/null; then
            echo "✓ $service_name is ready"
            return 0
        fi
        echo "  Attempt $attempt/$max_attempts: $service_name not ready, waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo "✗ Failed to connect to $service_name after $max_attempts attempts"
    return 1
}

# Function to run health checks
run_health_checks() {
    echo "Running pre-start health checks..."

    # Check broker connectivity
    if [ -n "$CELERY_BROKER_URL" ]; then
        BROKER_HOST=$(echo "$CELERY_BROKER_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
        BROKER_PORT=$(echo "$CELERY_BROKER_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p' | tail -1)
        wait_for_service "${BROKER_HOST:-rabbitmq}" "${BROKER_PORT:-5672}" "Message Broker"
    fi

    # Check result backend connectivity
    if [ -n "$CELERY_RESULT_BACKEND" ]; then
        BACKEND_HOST=$(echo "$CELERY_RESULT_BACKEND" | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
        BACKEND_PORT=$(echo "$CELERY_RESULT_BACKEND" | sed -n 's/.*:\([0-9]*\).*/\1/p' | tail -1)
        wait_for_service "${BACKEND_HOST:-redis}" "${BACKEND_PORT:-6379}" "Result Backend"
    fi

    # Check database connectivity (if needed for tasks)
    if [ -n "$DATABASE_URL" ]; then
        DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
        DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        wait_for_service "${DB_HOST:-postgres}" "${DB_PORT:-5432}" "PostgreSQL"
    fi

    echo "✓ All health checks passed"
}

# Main execution
case "$1" in
    worker)
        run_health_checks

        echo "Starting Celery worker..."
        exec celery -A "${CELERY_APP}" worker \
            --loglevel="${CELERY_LOGLEVEL}" \
            --concurrency="${CELERY_CONCURRENCY}" \
            --max-tasks-per-child="${CELERY_MAX_TASKS_PER_CHILD}" \
            --time-limit="${CELERY_TASK_TIME_LIMIT}" \
            --soft-time-limit="${CELERY_TASK_SOFT_TIME_LIMIT}" \
            --queues="${CELERY_QUEUES:-celery}" \
            --hostname="${CELERY_HOSTNAME:-worker@%h}"
        ;;

    beat)
        run_health_checks

        echo "Starting Celery beat scheduler..."
        exec celery -A "${CELERY_APP}" beat \
            --loglevel="${CELERY_LOGLEVEL}" \
            --pidfile="/tmp/celerybeat.pid" \
            --schedule="/tmp/celerybeat-schedule"
        ;;

    flower)
        run_health_checks

        echo "Starting Celery Flower monitoring..."
        exec celery -A "${CELERY_APP}" flower \
            --port="${FLOWER_PORT:-5555}" \
            --loglevel="${CELERY_LOGLEVEL}" \
            --basic_auth="${FLOWER_BASIC_AUTH:-admin:admin}"
        ;;

    shell)
        echo "Starting Celery shell..."
        exec python -c "from ${CELERY_APP} import app; import IPython; IPython.embed()"
        ;;

    *)
        echo "Unknown command: $1"
        echo "Available commands: worker, beat, flower, shell"
        exit 1
        ;;
esac