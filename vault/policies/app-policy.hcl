# Vault/OpenBao Policy for DotMac Platform Application
# Grants read access to application secrets

# Allow reading application secrets
path "secret/data/app/*" {
  capabilities = ["read", "list"]
}

# Allow reading auth secrets
path "secret/data/auth/*" {
  capabilities = ["read", "list"]
}

# Allow reading database credentials
path "secret/data/database/*" {
  capabilities = ["read", "list"]
}

# Allow reading storage credentials
path "secret/data/storage/*" {
  capabilities = ["read", "list"]
}

# Allow reading service credentials
path "secret/data/services/*" {
  capabilities = ["read", "list"]
}

# Allow token self-inspection
path "auth/token/lookup-self" {
  capabilities = ["read"]
}

# Allow token renewal
path "auth/token/renew-self" {
  capabilities = ["update"]
}
