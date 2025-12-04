#!/bin/bash
set -e

# Docker Entrypoint Script for DotMac Platform API
# Handles database migrations, health checks, and service startup

echo "========================================"
echo "DotMac Platform API Starting..."
echo "========================================"

# Function to wait for database
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

    echo "ERROR: Database failed to become ready after $max_attempts attempts"
    exit 1
}

# Function to wait for Redis
wait_for_redis() {
    echo "Waiting for Redis to be ready..."

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

# Function to run database migrations
run_migrations() {
    echo "Running database migrations..."

    if [ -f "/app/alembic.ini" ]; then
        cd /app
        python -m alembic upgrade head
        echo "Migrations completed successfully!"
    else
        echo "WARNING: alembic.ini not found, skipping migrations"
    fi
}

# Main entrypoint logic
main() {
    # Wait for dependencies
    wait_for_db
    wait_for_redis

    # Determine command
    COMMAND=${1:-api}

    case "$COMMAND" in
        api)
            echo "Starting API server..."

            # Run migrations if AUTO_MIGRATE is explicitly enabled (default: false)
            if [ "${AUTO_MIGRATE:-false}" = "true" ]; then
                run_migrations
            fi

            # Start API with Gunicorn
            exec gunicorn dotmac.platform.main:app \
                --worker-class ${GUNICORN_WORKER_CLASS} \
                --workers ${GUNICORN_WORKERS} \
                --bind ${GUNICORN_BIND} \
                --max-requests ${GUNICORN_MAX_REQUESTS} \
                --max-requests-jitter ${GUNICORN_MAX_REQUESTS_JITTER} \
                --timeout ${GUNICORN_TIMEOUT} \
                --keepalive ${GUNICORN_KEEPALIVE} \
                --access-logfile ${GUNICORN_ACCESS_LOG} \
                --error-logfile ${GUNICORN_ERROR_LOG} \
                --log-level ${GUNICORN_LOG_LEVEL}
            ;;

        migrate)
            echo "Running migrations only..."
            run_migrations
            echo "Migrations complete. Exiting."
            ;;

        shell)
            echo "Starting Python shell..."
            exec python
            ;;

        bash)
            echo "Starting bash shell..."
            exec /bin/bash
            ;;

        *)
            echo "Unknown command: $COMMAND"
            echo "Available commands: api, migrate, shell, bash"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
