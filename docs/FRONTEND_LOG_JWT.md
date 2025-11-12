# Frontend Log JWT Authentication - Future Enhancement

## Current Security Posture (Defense-in-Depth)

The frontend log ingestion endpoint currently uses multiple layers of defense:

1. **Shared Secret** (Primary) - `X-Frontend-Log-Secret` header
2. **Origin Validation** (Browser Defense) - HTTPS origin with proper URL parsing
3. **Authentication** (Optional) - User JWT tokens
4. **Metadata Limits** (DoS Prevention) - Size/depth/length validation
5. **Rate Limiting** (DoS Prevention) - 100 requests/min per IP

### Limitation

**Origin headers can be spoofed by non-browser clients** (curl, scripts, API tools). While the shared secret provides primary protection, it's a static credential that could be:
- Extracted from browser DevTools
- Leaked in client-side code
- Shared across all frontend instances

## Proposed Enhancement: Per-Client JWT Signing

Upgrade to cryptographically-strong client authentication using JWTs signed by each frontend instance.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend Instance                                               │
├─────────────────────────────────────────────────────────────────┤
│ 1. Generate client-specific keypair (on init)                  │
│ 2. Store public key in backend (via authenticated endpoint)     │
│ 3. For each log batch:                                          │
│    - Create JWT with claims: client_id, timestamp, nonce        │
│    - Sign with private key                                      │
│    - Send in X-Frontend-Log-Token header                        │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Backend API (/api/v1/audit/frontend-logs)                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. Extract X-Frontend-Log-Token JWT                            │
│ 2. Decode JWT header to get client_id (kid claim)              │
│ 3. Fetch client's public key from database/cache               │
│ 4. Verify JWT signature with public key                        │
│ 5. Validate claims:                                             │
│    - Timestamp within 5 minutes (prevent replay)                │
│    - Nonce not seen before (prevent replay)                     │
│    - Client_id matches registered client                        │
│ 6. Accept logs if all checks pass                              │
└─────────────────────────────────────────────────────────────────┘
```

### JWT Claims

```json
{
  "iss": "frontend-logger",
  "sub": "client_id_12345",
  "iat": 1699564800,
  "exp": 1699564860,
  "nonce": "uuid-v4-random",
  "batch_size": 10,
  "origin": "https://app.example.com"
}
```

### Benefits

1. **Non-repudiation** - Each frontend instance has unique cryptographic identity
2. **Replay Prevention** - Timestamp + nonce validation prevents reuse
3. **No Static Secrets** - Private keys never leave the browser
4. **Rotation Support** - Can rotate keys without deployment
5. **Audit Trail** - Know exactly which client sent which logs

### Implementation Steps

#### Phase 1: Backend Changes

1. **Database Schema** - Add `frontend_clients` table:
   ```sql
   CREATE TABLE frontend_clients (
     id UUID PRIMARY KEY,
     client_id VARCHAR(255) UNIQUE NOT NULL,
     public_key_pem TEXT NOT NULL,
     origin VARCHAR(255) NOT NULL,
     registered_at TIMESTAMP NOT NULL,
     last_seen_at TIMESTAMP,
     is_active BOOLEAN DEFAULT true,
     user_id UUID REFERENCES users(id),  -- who registered this client
     CONSTRAINT unique_client_id UNIQUE(client_id)
   );

   CREATE INDEX idx_frontend_clients_client_id ON frontend_clients(client_id);
   CREATE INDEX idx_frontend_clients_origin ON frontend_clients(origin);
   ```

2. **Registration Endpoint** - Add `POST /api/v1/audit/frontend-clients/register`:
   ```python
   @router.post("/frontend-clients/register")
   async def register_frontend_client(
       public_key_pem: str,
       origin: str,
       current_user: UserInfo = Depends(get_current_user),
   ) -> FrontendClientRegistration:
       # Validate public key format
       # Store in database
       # Return client_id
       pass
   ```

3. **JWT Verification** - Update `create_frontend_logs` endpoint:
   ```python
   # After shared secret check, add JWT verification
   if settings.audit.frontend_log_jwt_enabled:
       jwt_token = request.headers.get("X-Frontend-Log-Token")
       if not jwt_token:
           raise HTTPException(403, "JWT token required")

       # Decode header to get client_id (kid)
       unverified = jwt.decode(jwt_token, options={"verify_signature": False})
       client_id = unverified.get("sub")

       # Fetch public key
       client = await get_frontend_client(client_id)
       if not client or not client.is_active:
           raise HTTPException(403, "Unknown or inactive client")

       # Verify signature
       try:
           claims = jwt.decode(
               jwt_token,
               client.public_key_pem,
               algorithms=["RS256"],
               options={"verify_exp": True}
           )
       except JWTError:
           raise HTTPException(403, "Invalid JWT signature")

       # Check nonce (prevent replay)
       nonce = claims.get("nonce")
       if await nonce_was_used(nonce):
           raise HTTPException(403, "Replay attack detected")
       await mark_nonce_used(nonce, ttl=600)  # 10 min TTL
   ```

#### Phase 2: Frontend Changes

1. **Key Generation** (on app init):
   ```typescript
   import { generateKeyPair, exportJWK } from 'jose';

   async function initializeLogger() {
     // Check if we have keys in localStorage
     let privateKeyJWK = localStorage.getItem('frontend_log_private_key');
     let clientId = localStorage.getItem('frontend_log_client_id');

     if (!privateKeyJWK || !clientId) {
       // Generate new keypair
       const { publicKey, privateKey } = await generateKeyPair('RS256');

       const publicKeyJWK = await exportJWK(publicKey);
       privateKeyJWK = JSON.stringify(await exportJWK(privateKey));

       // Register with backend
       const response = await fetch('/api/v1/audit/frontend-clients/register', {
         method: 'POST',
         headers: { 'Authorization': `Bearer ${userToken}` },
         body: JSON.stringify({
           public_key_pem: await exportPEM(publicKey),
           origin: window.location.origin,
         }),
       });

       const { client_id } = await response.json();

       localStorage.setItem('frontend_log_private_key', privateKeyJWK);
       localStorage.setItem('frontend_log_client_id', client_id);
     }
   }
   ```

2. **JWT Signing** (on log batch):
   ```typescript
   import { SignJWT, importJWK } from 'jose';
   import { v4 as uuidv4 } from 'uuid';

   async function sendLogs(logs: FrontendLog[]) {
     const privateKeyJWK = JSON.parse(localStorage.getItem('frontend_log_private_key'));
     const clientId = localStorage.getItem('frontend_log_client_id');
     const privateKey = await importJWK(privateKeyJWK, 'RS256');

     // Create JWT
     const token = await new SignJWT({
       batch_size: logs.length,
       origin: window.location.origin,
     })
       .setProtectedHeader({ alg: 'RS256', kid: clientId })
       .setIssuer('frontend-logger')
       .setSubject(clientId)
       .setIssuedAt()
       .setExpirationTime('5m')
       .setJti(uuidv4())  // nonce
       .sign(privateKey);

     // Send with JWT
     await fetch('/api/v1/audit/frontend-logs', {
       method: 'POST',
       headers: {
         'X-Frontend-Log-Secret': SHARED_SECRET,  // Keep for backward compat
         'X-Frontend-Log-Token': token,
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({ logs }),
     });
   }
   ```

### Migration Path

1. **Phase 1**: Deploy backend changes with JWT support OPTIONAL
2. **Phase 2**: Deploy frontend changes to generate keys and send JWTs
3. **Phase 3**: Monitor adoption (% of requests with valid JWTs)
4. **Phase 4**: Make JWT REQUIRED in production (`frontend_log_jwt_required=true`)
5. **Phase 5**: Deprecate shared secret (keep for backward compatibility)

### Configuration

```bash
# Enable JWT authentication
AUDIT__FRONTEND_LOG_JWT_ENABLED=true

# Require JWT (reject requests without valid JWT)
AUDIT__FRONTEND_LOG_JWT_REQUIRED=true

# Nonce cache TTL (prevent replay attacks)
AUDIT__FRONTEND_LOG_JWT_NONCE_TTL=600

# Key rotation period (days)
AUDIT__FRONTEND_LOG_JWT_KEY_MAX_AGE=90
```

### Security Considerations

1. **Key Storage**: Private keys stored in localStorage (consider IndexedDB for better security)
2. **Key Rotation**: Implement automated key rotation every 90 days
3. **Revocation**: Support key revocation via `is_active` flag
4. **Monitoring**: Alert on suspicious patterns (multiple clients from same IP, rapid key rotation)
5. **Rate Limiting**: Per-client rate limits in addition to per-IP limits

### Fallback Strategy

- Keep shared secret as fallback during migration
- Log when requests use JWT vs shared secret only
- Gradual rollout with feature flags per tenant

## References

- [RFC 7519 - JSON Web Tokens](https://tools.ietf.org/html/rfc7519)
- [OWASP JWT Security](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

---

**Status**: Design document for future implementation (not yet implemented)

**Priority**: Medium (current defense-in-depth is adequate for most deployments)

**Effort**: ~2-3 sprints (backend + frontend + testing)
