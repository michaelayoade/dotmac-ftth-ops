# Real-Time Streaming Endpoints

The platform exposes several Server-Sent Event (SSE) streams for live dashboards. Every
endpoint requires a valid access token in the `Authorization` header and responds with
`text/event-stream`.

## Authentication

```bash
ACCESS_TOKEN="<jwt access token>"
TENANT_ID="<tenant uuid>"
BASE_URL="http://localhost:8000"
```

All examples below assume the backend is reachable at `$BASE_URL` and the caller has
already logged in to obtain an access token.

## ONU Status Stream

```bash
curl "$BASE_URL/api/v1/realtime/onu-status" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Accept: text/event-stream"
```

## Alerts Stream

```bash
curl "$BASE_URL/api/v1/realtime/alerts" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Accept: text/event-stream"
```

## Ticket Updates Stream

```bash
curl "$BASE_URL/api/v1/realtime/tickets" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Accept: text/event-stream"
```

## Subscriber Lifecycle Stream

```bash
curl "$BASE_URL/api/v1/realtime/subscribers" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Accept: text/event-stream"
```

## RADIUS Sessions Stream

```bash
curl "$BASE_URL/api/v1/realtime/radius-sessions" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Accept: text/event-stream"
```

> **Note**
>
> The `token=<jwt>` query parameter is not used. Always send the bearer token in the header
> (or rely on the `access_token` HttpOnly cookie).

## Troubleshooting

* 401 Unauthorized – the access token is missing or expired.
* 503/Redis error – ensure the Redis container is running and the backend has been restarted
  so the Redis client initialises successfully.
* Empty streams – verify the tenant has the required OSS configuration and feature flags.

## WebSocket Authentication

Browsers rely on the login HttpOnly cookie. For CLI tools, send the token in the `Authorization` header, e.g. `wscat -H "Authorization: Bearer $TOKEN" -c ws://localhost:8000/api/v1/realtime/ws/sessions`.
