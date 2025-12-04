#!/bin/bash

# Example script to set up Vault/OpenBao with secrets for DotMac Platform Services
# This script demonstrates how to configure Vault with the required secrets

# Prerequisites:
# - Vault or OpenBao installed and running
# - Vault CLI configured with appropriate credentials

# Set Vault address (adjust as needed)
export VAULT_ADDR="http://localhost:8200"

# Authenticate to Vault (use your preferred method)
# For development, you might use:
# vault login -method=token token=your-dev-token

echo "Setting up DotMac Platform Services secrets in Vault..."

# Application secrets
vault kv put secret/app/secret_key value="$(openssl rand -base64 32)"

# Database credentials
vault kv put secret/database/username value="dotmac_user"
vault kv put secret/database/password value="$(openssl rand -base64 24)"

# Redis credentials
vault kv put secret/redis/password value="$(openssl rand -base64 24)"

# JWT secret
vault kv put secret/auth/jwt_secret value="$(openssl rand -base64 32)"

# Email/SMTP credentials (adjust for your provider)
vault kv put secret/smtp/username value="noreply@example.com"
vault kv put secret/smtp/password value="your-smtp-password"

# Storage credentials (for S3/MinIO)
vault kv put secret/storage/access_key value="your-storage-access-key"
vault kv put secret/storage/secret_key value="your-storage-secret-key"

# Observability (optional)
vault kv put secret/observability/sentry_dsn value="https://your-sentry-dsn@sentry.io/project-id"

echo "Secrets have been stored in Vault!"
echo ""
echo "To verify the secrets:"
echo "  vault kv get secret/app/secret_key"
echo "  vault kv get secret/database/password"
echo ""
echo "Configure your .env file with:"
echo "  VAULT__ENABLED=true"
echo "  VAULT__URL=$VAULT_ADDR"
echo "  VAULT__TOKEN=your-vault-token"