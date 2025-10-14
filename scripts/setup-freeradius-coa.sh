#!/bin/bash
# Script to enable FreeRADIUS CoA/DM support
# Run this inside the FreeRADIUS container after it starts

set -e

echo "Setting up FreeRADIUS CoA (Change of Authorization) support..."

# Check if running inside container
if [ ! -d "/etc/raddb" ]; then
    echo "Error: This script must be run inside the FreeRADIUS container"
    echo "Usage: docker exec isp-freeradius /app/scripts/setup-freeradius-coa.sh"
    exit 1
fi

# Create symlink to enable CoA site
if [ ! -L "/etc/raddb/sites-enabled/coa" ]; then
    echo "Creating symlink for CoA configuration..."
    ln -sf /etc/raddb/sites-available/coa /etc/raddb/sites-enabled/coa
    echo "✓ CoA site enabled"
else
    echo "✓ CoA site already enabled"
fi

# Verify the configuration syntax
echo "Validating FreeRADIUS configuration..."
if radiusd -C; then
    echo "✓ Configuration is valid"
else
    echo "✗ Configuration has errors"
    exit 1
fi

# Check if CoA port is in the configuration
echo "Verifying CoA listener configuration..."
if grep -q "port = 3799" /etc/raddb/sites-available/coa; then
    echo "✓ CoA port 3799 configured"
else
    echo "⚠ Warning: CoA port 3799 not found in configuration"
fi

echo ""
echo "FreeRADIUS CoA setup complete!"
echo ""
echo "To apply changes, restart FreeRADIUS:"
echo "  docker restart isp-freeradius"
echo ""
echo "To test CoA disconnect:"
echo "  docker exec isp-freeradius radclient -x localhost:3799 disconnect testing123 <<< 'User-Name=test@isp.com'"
