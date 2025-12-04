#!/bin/sh
# docker/scripts/freeradius-entrypoint.sh
# Entrypoint script for FreeRADIUS container
# Processes configuration templates with environment variables

set -e

echo "🚀 Starting FreeRADIUS initialization..."

# Function to wait for PostgreSQL
wait_for_postgres() {
    echo "⏳ Waiting for PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}..."

    max_attempts=30
    attempt=0

    until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" > /dev/null 2>&1; do
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            echo "❌ PostgreSQL not available after ${max_attempts} attempts"
            exit 1
        fi
        echo "   Attempt $attempt/$max_attempts - PostgreSQL not ready, waiting..."
        sleep 2
    done

    echo "✅ PostgreSQL is ready"
}

# Process configuration templates
echo "📝 Processing configuration templates..."

# Process clients.conf template
if [ -f "/etc/freeradius/clients.conf.template" ]; then
    /usr/local/bin/config-templater.sh \
        /etc/freeradius/clients.conf.template \
        /etc/freeradius/clients.conf
    echo "   ✓ Processed clients.conf"
fi

# Process SQL module configuration template if it exists
if [ -f "/etc/freeradius/mods-available/sql.template" ]; then
    /usr/local/bin/config-templater.sh \
        /etc/freeradius/mods-available/sql.template \
        /etc/freeradius/mods-available/sql
    echo "   ✓ Processed sql module configuration"
fi

# Wait for PostgreSQL to be ready
wait_for_postgres

# Test database connection
echo "🔌 Testing database connection..."
if PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1" > /dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "⚠️  Warning: Could not connect to database, but continuing anyway"
fi

# Set log level based on environment
if [ "$RADIUS_DEBUG" = "yes" ] || [ "$RADIUS_DEBUG" = "true" ]; then
    echo "🐛 Debug mode enabled"
    set -- "$@" -X
fi

# Log configuration summary
echo ""
echo "📊 FreeRADIUS Configuration Summary:"
echo "   RADIUS Secret:    $(echo $RADIUS_SECRET | sed 's/./*/g')"
echo "   PostgreSQL Host:  $POSTGRES_HOST:$POSTGRES_PORT"
echo "   Database:         $POSTGRES_DB"
echo "   Database User:    $POSTGRES_USER"
echo "   Log Level:        $RADIUS_LOG_LEVEL"
echo "   Debug Mode:       $RADIUS_DEBUG"
echo ""

echo "✅ FreeRADIUS initialization complete"
echo "🎯 Starting FreeRADIUS server..."
echo ""

# Execute the main command
exec "$@"
