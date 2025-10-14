#!/bin/bash
set -e

# Default environment values
export PYTHONPATH=/app/src:${PYTHONPATH}

# Function to wait for services
wait_for_service() {
    local host=$1
    local port=$2
    local service=$3

    echo "⏳ Waiting for $service to be ready at $host:$port..."
    while ! nc -z "$host" "$port"; do
        sleep 1
    done
    echo "✅ $service is ready!"
}

# Function to check database connection
check_database() {
    echo "🔍 Checking database connection..."
    python -c "
from dotmac.platform.database.session import get_engine
import asyncio

async def check_db():
    try:
        engine = get_engine()
        async with engine.begin() as conn:
            await conn.execute('SELECT 1')
        print('✅ Database connection successful!')
        return True
    except Exception as e:
        print(f'❌ Database connection failed: {e}')
        return False

if not asyncio.run(check_db()):
    exit(1)
"
}

# Function to run database migrations
run_migrations() {
    echo "🔄 Running database migrations..."
    alembic upgrade head
    echo "✅ Migrations completed!"
}

# Function to setup initial data
setup_initial_data() {
    echo "🔧 Setting up initial data..."
    python -c "
import asyncio
from dotmac.platform.cli import setup_initial_admin, setup_jwt_keys

async def setup():
    try:
        await setup_jwt_keys()
        await setup_initial_admin()
        print('✅ Initial setup completed!')
    except Exception as e:
        print(f'⚠️  Initial setup warning: {e}')

asyncio.run(setup())
"
}

# Main entrypoint logic
main() {
    case "$1" in
        "api")
            echo "🚀 Starting DotMac Platform API..."

            # Wait for dependencies
            if [ -n "${DATABASE__HOST}" ]; then
                wait_for_service "${DATABASE__HOST}" "${DATABASE__PORT:-5432}" "PostgreSQL"
            fi

            if [ -n "${REDIS__HOST}" ]; then
                wait_for_service "${REDIS__HOST}" "${REDIS__PORT:-6379}" "Redis"
            fi

            if [ -n "${VAULT__URL}" ]; then
                VAULT_HOST=$(echo "${VAULT__URL}" | sed 's/http[s]*:\/\///' | cut -d: -f1)
                VAULT_PORT=$(echo "${VAULT__URL}" | sed 's/http[s]*:\/\///' | cut -d: -f2 | cut -d/ -f1)
                wait_for_service "${VAULT_HOST}" "${VAULT_PORT:-8200}" "Vault"
            fi

            # Database setup
            check_database
            run_migrations
            setup_initial_data

            # Start API server
            echo "🌟 Starting API server with Gunicorn..."
            exec gunicorn dotmac.platform.main:app \
                --worker-class "${GUNICORN_WORKER_CLASS}" \
                --workers "${GUNICORN_WORKERS}" \
                --bind "${GUNICORN_BIND}" \
                --max-requests "${GUNICORN_MAX_REQUESTS}" \
                --max-requests-jitter "${GUNICORN_MAX_REQUESTS_JITTER}" \
                --timeout "${GUNICORN_TIMEOUT}" \
                --keepalive "${GUNICORN_KEEPALIVE}" \
                --access-logfile "${GUNICORN_ACCESS_LOG}" \
                --error-logfile "${GUNICORN_ERROR_LOG}" \
                --log-level "${GUNICORN_LOG_LEVEL}" \
                --capture-output \
                --enable-stdio-inheritance
            ;;

        "migrate")
            echo "🔄 Running migrations only..."
            check_database
            run_migrations
            echo "✅ Migration completed!"
            ;;

        "setup")
            echo "🔧 Running initial setup only..."
            check_database
            setup_initial_data
            echo "✅ Setup completed!"
            ;;

        "shell")
            echo "🐚 Starting interactive shell..."
            exec python -c "
import asyncio
from dotmac.platform.database.session import get_session
from dotmac.platform.core.models import *
from dotmac.platform.auth.models import *
from dotmac.platform.secrets.models import *

async def main():
    print('DotMac Platform Shell')
    print('Available imports: get_session, User, Tenant, etc.')
    # Start IPython if available, otherwise regular Python
    try:
        from IPython import start_ipython
        start_ipython(argv=[])
    except ImportError:
        import code
        code.interact(local=locals())

asyncio.run(main())
"
            ;;

        "health")
            echo "🏥 Running health check..."
            python -c "
import asyncio
from dotmac.platform.observability.health import health_check

async def check():
    result = await health_check()
    if result['status'] == 'healthy':
        print('✅ All systems healthy!')
        exit(0)
    else:
        print('❌ Health check failed!')
        print(result)
        exit(1)

asyncio.run(check())
"
            ;;

        *)
            echo "Usage: $0 {api|migrate|setup|shell|health}"
            echo ""
            echo "Commands:"
            echo "  api     - Start the API server (default)"
            echo "  migrate - Run database migrations only"
            echo "  setup   - Run initial setup only"
            echo "  shell   - Start interactive Python shell"
            echo "  health  - Run health check"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"