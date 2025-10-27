"""
Central Model Registry

This module imports all SQLAlchemy models to ensure they are registered
with the Base metadata before any queries or entity instantiation occurs.

This solves circular dependency issues where model relationships reference
other models that haven't been imported yet.

Import this module early in your application initialization or in test conftest.py
to ensure all models are registered.
"""

# Core platform models
from dotmac.platform.analytics.models import (  # noqa: F401
    AnalyticsEvent,
    Metric,
)

# Audit and analytics
from dotmac.platform.audit.models import AuditActivity  # noqa: F401

# Auth models
from dotmac.platform.auth.models import (  # noqa: F401
    Permission,
    Role,
)

# Billing models
from dotmac.platform.billing.core.models import (  # noqa: F401
    CreditApplication,
    CreditNote,
    CreditNoteLineItem,
    CustomerCredit,
    Invoice,
    InvoiceItem,
    InvoiceLineItem,
    Payment,
    PaymentMethod,
    Price,
    Service,
    Subscription,
    Transaction,
)

# Communications
from dotmac.platform.communications.models import (  # noqa: F401
    EmailTemplate,
    SMSTemplate,
)
from dotmac.platform.contacts.models import Contact  # noqa: F401

# CRM
from dotmac.platform.crm.models import Lead, SiteSurvey  # noqa: F401

# Customer and user management
from dotmac.platform.customer_management.models import Customer  # noqa: F401

# Deployment
from dotmac.platform.deployment.models import Deployment  # noqa: F401

# Jobs
from dotmac.platform.jobs.models import Job, JobChain  # noqa: F401

# Notifications
from dotmac.platform.notifications.models import Notification  # noqa: F401

# Orchestration and workflows
from dotmac.platform.orchestration.models import (  # noqa: F401
    OrchestrationWorkflow,
    OrchestrationWorkflowStep,
)

# RADIUS and network
from dotmac.platform.radius.models import (  # noqa: F401
    NAS,
    RadAcct,
    RadCheck,
    RadiusBandwidthProfile,
    RadPostAuth,
    RadReply,
)
from dotmac.platform.subscribers.models import Subscriber  # noqa: F401
from dotmac.platform.tenant.models import Tenant, TenantInvitation  # noqa: F401

# Ticketing
from dotmac.platform.ticketing.models import Ticket, TicketMessage  # noqa: F401
from dotmac.platform.user_management.models import User  # noqa: F401

# Webhooks and events
from dotmac.platform.webhooks.models import (  # noqa: F401
    Webhook,
    WebhookDelivery,
    WebhookEvent,
)

# Wireless
from dotmac.platform.wireless.models import (  # noqa: F401
    AccessPoint,
    CoverageZone,
    Radio,
    SubscriberCPE,
    Tower,
)
from dotmac.platform.workflows.models import (  # noqa: F401
    Workflow,
    WorkflowExecution,
    WorkflowExecutionStep,
)

# Services
try:
    from dotmac.platform.services.internet_plans.models import InternetPlan  # noqa: F401
except ImportError:
    pass

# Import additional billing sub-models
try:
    from dotmac.platform.billing.subscriptions.models import (  # noqa: F401
        SubscriptionAddon,
        SubscriptionPlan,
    )
except ImportError:
    pass

try:
    from dotmac.platform.billing.catalog.models import Product  # noqa: F401
except ImportError:
    pass

try:
    from dotmac.platform.billing.pricing.models import PricingRule  # noqa: F401
except ImportError:
    pass

try:
    from dotmac.platform.billing.dunning.models import DunningCampaign  # noqa: F401
except ImportError:
    pass

try:
    from dotmac.platform.billing.bank_accounts.models import BankAccount  # noqa: F401
except ImportError:
    pass

# All models are now registered with SQLAlchemy Base
__all__ = [
    "Tenant",
    "Customer",
    "Subscriber",
    "User",
    "RadCheck",
    "RadReply",
    "Invoice",
    "Payment",
]
