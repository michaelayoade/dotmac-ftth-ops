#!/bin/bash
set -e

# Docker Entrypoint Script for Celery Worker/Beat
# Handles wait-for-deps and service startup

echo "========================================"
echo "DotMac Platform Celery Starting..."
echo "========================================"

# Function to wait for Redis (Celery broker)
wait_for_redis() {
    echo "Waiting for Redis (Celery broker) to be ready..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if nc -z "${REDIS__HOST:-redis}" "${REDIS__PORT:-6379}" 2>/dev/null; then
            echo "Redis is ready!"
            return 0
        fi

        echo "Attempt $attempt/$max_attempts: Redis not ready, waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo "ERROR: Redis failed to become ready after $max_attempts attempts"
    exit 1
}

# Function to wait for database (needed for task execution)
wait_for_db() {
    echo "Waiting for database to be ready..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if nc -z "${DATABASE__HOST:-postgres}" "${DATABASE__PORT:-5432}" 2>/dev/null; then
            echo "Database is ready!"
            return 0
        fi

        echo "Attempt $attempt/$max_attempts: Database not ready, waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo "WARNING: Database not available, some tasks may fail..."
    return 0
}

# Main entrypoint logic
main() {
    # Wait for dependencies
    wait_for_redis
    wait_for_db

    # Determine command
    COMMAND=${1:-worker}

    case "$COMMAND" in
        worker)
            echo "Starting Celery Worker..."
            echo "App: ${CELERY_APP}"
            echo "Queues: ${CELERY_QUEUES}"
            echo "Concurrency: ${CELERY_CONCURRENCY}"

            exec celery -A ${CELERY_APP} worker \
                --loglevel=${CELERY_LOGLEVEL} \
                --concurrency=${CELERY_CONCURRENCY} \
                --max-tasks-per-child=${CELERY_MAX_TASKS_PER_CHILD} \
                --queues=${CELERY_QUEUES} \
                --hostname=${CELERY_HOSTNAME} \
                --time-limit=${CELERY_TASK_TIME_LIMIT} \
                --soft-time-limit=${CELERY_TASK_SOFT_TIME_LIMIT}
            ;;

        beat)
            echo "Starting Celery Beat..."
            exec celery -A ${CELERY_APP} beat \
                --loglevel=${CELERY_LOGLEVEL} \
                --pidfile=/tmp/celerybeat.pid \
                --schedule=/tmp/celerybeat-schedule.db
            ;;

        flower)
            echo "Starting Celery Flower..."
            exec celery -A ${CELERY_APP} flower \
                --port=5555 \
                --loglevel=${CELERY_LOGLEVEL}
            ;;

        *)
            echo "Unknown command: $COMMAND"
            echo "Available commands: worker, beat, flower"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
