# AI Integration Module

## Status: DISABLED ⚠️

This module is currently disabled because it lacks the necessary integrations to provide value:

### Missing Requirements
- ❌ **No data access** - Cannot query customer records, billing, network info
- ❌ **No function calling** - Cannot perform actions (create tickets, send emails, etc.)
- ❌ **No RAG integration** - No knowledge base or document retrieval
- ❌ **No ticket integration** - Escalation doesn't create actual tickets
- ❌ **No email integration** - Cannot draft or send email responses
- ❌ **No RBAC** - No permission distinctions for different user roles

### What's Implemented
✅ Database schema (ai_chat_sessions, ai_chat_messages)
✅ REST API endpoints for chat
✅ Frontend chat widget component
✅ React hook for API integration
✅ Basic OpenAI/Claude integration
✅ Multi-tenant session management
✅ Cost tracking and rate limiting

### To Enable

When ready to implement full functionality:

1. **Uncomment router registration** in `src/dotmac/platform/routers.py`
2. **Implement function calling** to access your data:
   ```python
   # In AIService, add tools for:
   - search_customers()
   - get_ticket_details()
   - create_ticket()
   - send_email()
   - query_network_status()
   ```
3. **Add RAG integration** with vector database for knowledge base
4. **Integrate with ticketing** module for actual escalation
5. **Integrate with communications** module for email responses
6. **Add RBAC checks** for different session types

### Database Cleanup (Optional)

If you want to remove the database tables:

```bash
# Rollback the migration
poetry run alembic downgrade -1

# Or manually drop tables
psql -d your_database -c "DROP TABLE IF EXISTS ai_chat_messages CASCADE;"
psql -d your_database -c "DROP TABLE IF EXISTS ai_chat_sessions CASCADE;"
```

### Documentation

See full implementation guide:
- **Architecture**: `/docs/AI_INTEGRATION_GUIDE.md`
- **Usage Guide**: `/docs/AI_USAGE_GUIDE.md`

### Phase Requirements

To make this valuable for ISP operations:

**Phase 1 (Current):** ✅ Foundation - Chat infrastructure
**Phase 2 (Needed):** Knowledge Base + Data Access
**Phase 3 (Needed):** Action Capabilities (tickets, emails, provisioning)
**Phase 4 (Needed):** Automation + Intelligence (anomaly detection, recommendations)

Only Phases 2-4 provide actual business value for tenant admins and operators.
