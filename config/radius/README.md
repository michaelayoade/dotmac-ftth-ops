# RADIUS Dictionary Files

This directory contains minimal RADIUS dictionary files required for the dotmac FTTH platform's CoA/DM (Change of Authorization / Disconnect Messages) functionality.

## Files

### dictionary
Core RADIUS attribute definitions from RFC 2865 and RFC 2866. Contains:
- User identification attributes (User-Name, NAS-IP-Address, etc.)
- Service parameters (Service-Type, Framed-Protocol, etc.)
- Accounting attributes (Acct-Session-Id, Acct-Status-Type, etc.)
- Common value mappings

### dictionary.rfc5176
RFC 5176 extensions for dynamic authorization. Contains:
- CoA packet types (CoA-Request, CoA-ACK, CoA-NAK)
- Disconnect packet types (Disconnect-Request, Disconnect-ACK, Disconnect-NAK)
- Error-Cause attribute and values
- Usage examples

## Usage

### Development
For local development, these bundled dictionaries are sufficient. The platform will automatically use them if no system dictionaries are found.

```bash
# Dictionaries are automatically loaded from config/radius/
poetry run python -m dotmac.platform.main
```

### Production
For production deployments, it's recommended to use the full FreeRADIUS dictionary set for maximum compatibility:

#### Option 1: Download Full Dictionaries
```bash
# Run the setup script
./scripts/setup_radius_dictionaries.sh /etc/raddb
```

#### Option 2: Install FreeRADIUS Package
```bash
# On Debian/Ubuntu
apt-get install freeradius-utils

# On RHEL/CentOS
yum install freeradius-utils

# Dictionaries will be in /usr/share/freeradius/
```

#### Option 3: Docker
```dockerfile
FROM python:3.13-slim

# Download FreeRADIUS dictionaries
RUN mkdir -p /etc/raddb && \
    curl -sSL https://raw.githubusercontent.com/FreeRADIUS/freeradius-server/v3.2.x/share/dictionary \
         -o /etc/raddb/dictionary && \
    curl -sSL https://raw.githubusercontent.com/FreeRADIUS/freeradius-server/v3.2.x/share/dictionary.rfc5176 \
         -o /etc/raddb/dictionary.rfc5176
```

## Configuration

Set environment variables to specify dictionary locations:

```bash
# Use bundled dictionaries (development)
export RADIUS_DICTIONARY_PATH="./config/radius/dictionary"
export RADIUS_DICTIONARY_COA_PATH="./config/radius/dictionary.rfc5176"

# Use system dictionaries (production)
export RADIUS_DICTIONARY_PATH="/etc/raddb/dictionary"
export RADIUS_DICTIONARY_COA_PATH="/etc/raddb/dictionary.rfc5176"
```

Or add to `.env` file:

```env
RADIUS_DICTIONARY_PATH=/etc/raddb/dictionary
RADIUS_DICTIONARY_COA_PATH=/etc/raddb/dictionary.rfc5176
```

## Vendor-Specific Attributes

If you need vendor-specific RADIUS attributes (Cisco, Mikrotik, etc.), download the appropriate vendor dictionary from FreeRADIUS:

```bash
# Example: Cisco VSAs
curl -sSL https://raw.githubusercontent.com/FreeRADIUS/freeradius-server/v3.2.x/share/dictionary.cisco \
     -o /etc/raddb/dictionary.cisco

# Add to main dictionary file:
echo '$INCLUDE dictionary.cisco' >> /etc/raddb/dictionary
```

## References

- [RFC 2865 - RADIUS](https://tools.ietf.org/html/rfc2865)
- [RFC 2866 - RADIUS Accounting](https://tools.ietf.org/html/rfc2866)
- [RFC 5176 - Dynamic Authorization Extensions](https://tools.ietf.org/html/rfc5176)
- [FreeRADIUS Dictionaries](https://github.com/FreeRADIUS/freeradius-server/tree/v3.2.x/share)

## License

These dictionaries are based on FreeRADIUS dictionaries, which are licensed under GPL v2.
See: https://github.com/FreeRADIUS/freeradius-server/blob/v3.2.x/COPYRIGHT
