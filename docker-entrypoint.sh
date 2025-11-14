#!/bin/bash
set -e

# Fix permissions for volume-mounted directories
# This allows the non-root appuser to write to /var/lib/dotmac
if [ -d "/var/lib/dotmac" ]; then
    echo "Fixing permissions for /var/lib/dotmac..."
    chown -R appuser:appuser /var/lib/dotmac
    chmod -R 755 /var/lib/dotmac
fi

# Execute the main command as appuser (non-root)
exec gosu appuser "$@"
