#!/usr/bin/env python3
"""
Seed script for Composable Licensing Framework.

Creates initial feature modules, quota definitions, and example service plans.
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from dotmac.platform.licensing.framework import (
    ModuleCategory,
    PricingModel,
    BillingCycle,
)
from dotmac.platform.licensing.service_framework import LicensingFrameworkService
from dotmac.platform.settings import settings


async def seed_framework():
    """Seed the licensing framework with initial data."""

    # Get database URL from environment
    import os
    database_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://dotmac_user:change-me-in-production@localhost:5432/dotmac")

    # Convert postgresql:// to postgresql+asyncpg://
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    # Create async engine
    engine = create_async_engine(
        database_url,
        echo=False,
    )

    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as db:
        service = LicensingFrameworkService(db)

        print("🌱 Seeding Composable Licensing Framework...\n")

        # ====================================================================
        # STEP 1: Create Feature Modules
        # ====================================================================

        print("📦 Creating Feature Modules...")

        # RADIUS AAA Module
        radius_module = await service.create_feature_module(
            module_code="radius_aaa",
            module_name="RADIUS AAA",
            category=ModuleCategory.NETWORK,
            description="RADIUS authentication, authorization, and accounting for ISP access control",
            dependencies=[],
            pricing_model=PricingModel.FLAT_FEE,
            base_price=99.00,
            config_schema={
                "type": "object",
                "properties": {
                    "max_nas_devices": {"type": "integer", "minimum": 1},
                    "redundancy_enabled": {"type": "boolean"},
                    "session_timeout": {"type": "integer", "minimum": 60}
                }
            },
            default_config={
                "max_nas_devices": 10,
                "redundancy_enabled": False,
                "session_timeout": 3600
            }
        )
        print(f"  ✓ {radius_module.module_name} - ${radius_module.base_price}/mo")

        # Add RADIUS capabilities
        await service.add_module_capability(
            module_id=radius_module.id,
            capability_code="radius_authentication",
            capability_name="RADIUS Authentication",
            description="Authenticate subscribers via RADIUS protocol",
            api_endpoints=["/api/v1/radius/auth", "/api/v1/radius/sessions"],
            ui_routes=["/dashboard/radius", "/dashboard/radius/sessions"],
            config={}
        )

        await service.add_module_capability(
            module_id=radius_module.id,
            capability_code="nas_management",
            capability_name="NAS Device Management",
            description="Manage Network Access Server devices",
            api_endpoints=["/api/v1/radius/nas"],
            ui_routes=["/dashboard/radius/nas"],
            config={}
        )

        # Wireless Management Module
        wireless_module = await service.create_feature_module(
            module_code="wireless_management",
            module_name="Wireless Management",
            category=ModuleCategory.NETWORK,
            description="Comprehensive wireless infrastructure management (APs, controllers, mesh networks)",
            dependencies=[],
            pricing_model=PricingModel.FLAT_FEE,
            base_price=149.00,
            config_schema={
                "type": "object",
                "properties": {
                    "max_access_points": {"type": "integer", "minimum": 1},
                    "mesh_support": {"type": "boolean"},
                    "spectrum_analysis": {"type": "boolean"}
                }
            },
            default_config={
                "max_access_points": 50,
                "mesh_support": False,
                "spectrum_analysis": False
            }
        )
        print(f"  ✓ {wireless_module.module_name} - ${wireless_module.base_price}/mo")

        # Billing Module
        billing_module = await service.create_feature_module(
            module_code="billing_core",
            module_name="Billing & Invoicing",
            category=ModuleCategory.BILLING,
            description="Core billing engine with invoicing, payments, and revenue management",
            dependencies=[],
            pricing_model=PricingModel.FLAT_FEE,
            base_price=79.00,
            config_schema={
                "type": "object",
                "properties": {
                    "auto_invoice": {"type": "boolean"},
                    "payment_reminders": {"type": "boolean"},
                    "multi_currency": {"type": "boolean"}
                }
            },
            default_config={
                "auto_invoice": True,
                "payment_reminders": True,
                "multi_currency": False
            }
        )
        print(f"  ✓ {billing_module.module_name} - ${billing_module.base_price}/mo")

        # Analytics Module
        analytics_module = await service.create_feature_module(
            module_code="analytics_advanced",
            module_name="Advanced Analytics",
            category=ModuleCategory.ANALYTICS,
            description="Business intelligence, dashboards, and advanced reporting",
            dependencies=[],
            pricing_model=PricingModel.FLAT_FEE,
            base_price=69.00,
            config_schema={
                "type": "object",
                "properties": {
                    "custom_dashboards": {"type": "boolean"},
                    "data_export": {"type": "boolean"},
                    "predictive_analytics": {"type": "boolean"}
                }
            },
            default_config={
                "custom_dashboards": True,
                "data_export": True,
                "predictive_analytics": False
            }
        )
        print(f"  ✓ {analytics_module.module_name} - ${analytics_module.base_price}/mo")

        # Automation Module
        automation_module = await service.create_feature_module(
            module_code="automation_workflows",
            module_name="Automation & Workflows",
            category=ModuleCategory.AUTOMATION,
            description="Workflow automation, orchestration, and service provisioning",
            dependencies=[],
            pricing_model=PricingModel.FLAT_FEE,
            base_price=89.00,
            config_schema={
                "type": "object",
                "properties": {
                    "max_workflows": {"type": "integer", "minimum": 1},
                    "ansible_integration": {"type": "boolean"},
                    "scheduled_tasks": {"type": "boolean"}
                }
            },
            default_config={
                "max_workflows": 20,
                "ansible_integration": True,
                "scheduled_tasks": True
            }
        )
        print(f"  ✓ {automation_module.module_name} - ${automation_module.base_price}/mo")

        # Ticketing Module - COMMENTED OUT due to enum mismatch
        # ticketing_module = await service.create_feature_module(...)

        print(f"\n✅ Created 5 feature modules\n")

        # ====================================================================
        # STEP 2: Create Quota Definitions
        # ====================================================================

        print("📊 Creating Quota Definitions...")

        # Staff Users Quota
        staff_quota = await service.create_quota_definition(
            quota_code="staff_users",
            quota_name="Staff Users",
            description="Number of staff/admin users who can access the platform",
            unit_name="users",
            pricing_model=PricingModel.PER_UNIT,
            overage_rate=5.00,
            is_metered=False,
            reset_period=None,
            config={}
        )
        print(f"  ✓ {staff_quota.quota_name} - ${staff_quota.overage_rate}/user overage")

        # Active Subscribers Quota
        subscribers_quota = await service.create_quota_definition(
            quota_code="active_subscribers",
            quota_name="Active Subscribers",
            description="Number of active customer subscriptions/accounts",
            unit_name="subscribers",
            pricing_model=PricingModel.TIERED,
            overage_rate=0.10,
            is_metered=False,
            reset_period=None,
            config={}
        )
        print(f"  ✓ {subscribers_quota.quota_name} - ${subscribers_quota.overage_rate}/subscriber overage")

        # API Calls Quota
        api_quota = await service.create_quota_definition(
            quota_code="api_calls_monthly",
            quota_name="Monthly API Calls",
            description="Number of API calls per month",
            unit_name="calls",
            pricing_model=PricingModel.USAGE_BASED,
            overage_rate=0.001,
            is_metered=True,
            reset_period="MONTHLY",
            config={}
        )
        print(f"  ✓ {api_quota.quota_name} - ${api_quota.overage_rate}/call overage")

        # Storage Quota
        storage_quota = await service.create_quota_definition(
            quota_code="storage_gb",
            quota_name="Storage Space",
            description="Total storage space in GB for documents, backups, logs",
            unit_name="GB",
            pricing_model=PricingModel.PER_UNIT,
            overage_rate=0.50,
            is_metered=False,
            reset_period=None,
            config={}
        )
        print(f"  ✓ {storage_quota.quota_name} - ${storage_quota.overage_rate}/GB overage")

        # Support Tickets Quota
        tickets_quota = await service.create_quota_definition(
            quota_code="support_tickets_monthly",
            quota_name="Monthly Support Tickets",
            description="Number of support tickets that can be created per month",
            unit_name="tickets",
            pricing_model=PricingModel.FLAT_FEE,
            overage_rate=2.00,
            is_metered=True,
            reset_period="MONTHLY",
            config={}
        )
        print(f"  ✓ {tickets_quota.quota_name} - ${tickets_quota.overage_rate}/ticket overage")

        print(f"\n✅ Created {5} quota definitions\n")

        # ====================================================================
        # STEP 3: Create Service Plan Templates
        # ====================================================================

        print("🎯 Creating Service Plan Templates...")

        # Starter Plan Template
        starter_plan = await service.create_service_plan(
            plan_name="Starter Plan",
            plan_code="starter_v1",
            description="Perfect for small ISPs getting started with basic features",
            base_price_monthly=99.00,
            annual_discount_percent=15.0,
            is_template=True,
            is_public=True,
            is_custom=False,
            trial_days=14,
            trial_modules=["radius_aaa", "billing_core"],
            module_configs=[
                {
                    "module_id": radius_module.id,
                    "included": True,
                    "addon": False,
                    "price": None,
                    "trial_only": False,
                    "config": {}
                },
                {
                    "module_id": billing_module.id,
                    "included": True,
                    "addon": False,
                    "price": None,
                    "trial_only": False,
                    "config": {}
                },
                {
                    "module_id": ticketing_module.id,
                    "included": False,
                    "addon": True,
                    "price": None,
                    "trial_only": False,
                    "config": {}
                }
            ],
            quota_configs=[
                {
                    "quota_id": staff_quota.id,
                    "quantity": 3,
                    "soft_limit": 2,
                    "allow_overage": True,
                    "overage_rate": None,
                    "pricing_tiers": [],
                    "config": {}
                },
                {
                    "quota_id": subscribers_quota.id,
                    "quantity": 500,
                    "soft_limit": 450,
                    "allow_overage": True,
                    "overage_rate": None,
                    "pricing_tiers": [],
                    "config": {}
                },
                {
                    "quota_id": api_quota.id,
                    "quantity": 100000,
                    "soft_limit": 90000,
                    "allow_overage": True,
                    "overage_rate": None,
                    "pricing_tiers": [],
                    "config": {}
                },
                {
                    "quota_id": storage_quota.id,
                    "quantity": 10,
                    "soft_limit": 8,
                    "allow_overage": True,
                    "overage_rate": None,
                    "pricing_tiers": [],
                    "config": {}
                }
            ],
            metadata={
                "target_market": "Small ISPs (< 500 subscribers)",
                "recommended_for": ["Startups", "WISPs", "Community Networks"]
            }
        )
        print(f"  ✓ {starter_plan.plan_name} - ${starter_plan.base_price_monthly}/mo")
        print(f"    - Includes: RADIUS AAA, Billing")
        print(f"    - Quotas: 3 staff, 500 subscribers, 100K API calls, 10GB storage")

        # Professional Plan Template
        professional_plan = await service.create_service_plan(
            plan_name="Professional Plan",
            plan_code="professional_v1",
            description="Full-featured plan for growing ISPs with advanced capabilities",
            base_price_monthly=299.00,
            annual_discount_percent=20.0,
            is_template=True,
            is_public=True,
            is_custom=False,
            trial_days=30,
            trial_modules=["radius_aaa", "wireless_management", "billing_core"],
            module_configs=[
                {
                    "module_id": radius_module.id,
                    "included": True,
                    "addon": False,
                    "price": None,
                    "trial_only": False,
                    "config": {}
                },
                {
                    "module_id": wireless_module.id,
                    "included": True,
                    "addon": False,
                    "price": None,
                    "trial_only": False,
                    "config": {}
                },
                {
                    "module_id": billing_module.id,
                    "included": True,
                    "addon": False,
                    "price": None,
                    "trial_only": False,
                    "config": {}
                },
                {
                    "module_id": ticketing_module.id,
                    "included": True,
                    "addon": False,
                    "price": None,
                    "trial_only": False,
                    "config": {}
                },
                {
                    "module_id": analytics_module.id,
                    "included": False,
                    "addon": True,
                    "price": None,
                    "trial_only": False,
                    "config": {}
                },
                {
                    "module_id": automation_module.id,
                    "included": False,
                    "addon": True,
                    "price": None,
                    "trial_only": False,
                    "config": {}
                }
            ],
            quota_configs=[
                {
                    "quota_id": staff_quota.id,
                    "quantity": 10,
                    "soft_limit": 9,
                    "allow_overage": True,
                    "overage_rate": None,
                    "pricing_tiers": [],
                    "config": {}
                },
                {
                    "quota_id": subscribers_quota.id,
                    "quantity": 5000,
                    "soft_limit": 4500,
                    "allow_overage": True,
                    "overage_rate": 0.08,
                    "pricing_tiers": [
                        {"from": 0, "to": 2500, "price": 0},
                        {"from": 2501, "to": 5000, "price": 0.05},
                        {"from": 5001, "to": 10000, "price": 0.03}
                    ],
                    "config": {}
                },
                {
                    "quota_id": api_quota.id,
                    "quantity": 500000,
                    "soft_limit": 450000,
                    "allow_overage": True,
                    "overage_rate": None,
                    "pricing_tiers": [],
                    "config": {}
                },
                {
                    "quota_id": storage_quota.id,
                    "quantity": 50,
                    "soft_limit": 45,
                    "allow_overage": True,
                    "overage_rate": None,
                    "pricing_tiers": [],
                    "config": {}
                },
                {
                    "quota_id": tickets_quota.id,
                    "quantity": 100,
                    "soft_limit": 90,
                    "allow_overage": True,
                    "overage_rate": None,
                    "pricing_tiers": [],
                    "config": {}
                }
            ],
            metadata={
                "target_market": "Growing ISPs (500-5000 subscribers)",
                "recommended_for": ["Regional ISPs", "Fiber Networks", "Cable Operators"]
            }
        )
        print(f"\n  ✓ {professional_plan.plan_name} - ${professional_plan.base_price_monthly}/mo")
        print(f"    - Includes: RADIUS, Wireless, Billing, Ticketing")
        print(f"    - Add-ons: Analytics, Automation")
        print(f"    - Quotas: 10 staff, 5K subscribers, 500K API calls, 50GB storage")

        # Enterprise Plan Template
        enterprise_plan = await service.create_service_plan(
            plan_name="Enterprise Plan",
            plan_code="enterprise_v1",
            description="Unlimited plan for large ISPs with all features and premium support",
            base_price_monthly=999.00,
            annual_discount_percent=25.0,
            is_template=True,
            is_public=True,
            is_custom=False,
            trial_days=30,
            trial_modules=[],
            module_configs=[
                {
                    "module_id": radius_module.id,
                    "included": True,
                    "addon": False,
                    "price": None,
                    "trial_only": False,
                    "config": {}
                },
                {
                    "module_id": wireless_module.id,
                    "included": True,
                    "addon": False,
                    "price": None,
                    "trial_only": False,
                    "config": {}
                },
                {
                    "module_id": billing_module.id,
                    "included": True,
                    "addon": False,
                    "price": None,
                    "trial_only": False,
                    "config": {}
                },
                {
                    "module_id": analytics_module.id,
                    "included": True,
                    "addon": False,
                    "price": None,
                    "trial_only": False,
                    "config": {}
                },
                {
                    "module_id": automation_module.id,
                    "included": True,
                    "addon": False,
                    "price": None,
                    "trial_only": False,
                    "config": {}
                },
                {
                    "module_id": ticketing_module.id,
                    "included": True,
                    "addon": False,
                    "price": None,
                    "trial_only": False,
                    "config": {}
                }
            ],
            quota_configs=[
                {
                    "quota_id": staff_quota.id,
                    "quantity": -1,  # Unlimited
                    "soft_limit": None,
                    "allow_overage": False,
                    "overage_rate": None,
                    "pricing_tiers": [],
                    "config": {}
                },
                {
                    "quota_id": subscribers_quota.id,
                    "quantity": -1,  # Unlimited
                    "soft_limit": None,
                    "allow_overage": False,
                    "overage_rate": None,
                    "pricing_tiers": [],
                    "config": {}
                },
                {
                    "quota_id": api_quota.id,
                    "quantity": -1,  # Unlimited
                    "soft_limit": None,
                    "allow_overage": False,
                    "overage_rate": None,
                    "pricing_tiers": [],
                    "config": {}
                },
                {
                    "quota_id": storage_quota.id,
                    "quantity": 500,
                    "soft_limit": 450,
                    "allow_overage": True,
                    "overage_rate": 0.30,
                    "pricing_tiers": [],
                    "config": {}
                },
                {
                    "quota_id": tickets_quota.id,
                    "quantity": -1,  # Unlimited
                    "soft_limit": None,
                    "allow_overage": False,
                    "overage_rate": None,
                    "pricing_tiers": [],
                    "config": {}
                }
            ],
            metadata={
                "target_market": "Large ISPs (5000+ subscribers)",
                "recommended_for": ["Tier 2/3 ISPs", "National Networks", "Enterprise"],
                "includes_premium_support": True
            }
        )
        print(f"\n  ✓ {enterprise_plan.plan_name} - ${enterprise_plan.base_price_monthly}/mo")
        print(f"    - Includes: All modules (6 features)")
        print(f"    - Quotas: Unlimited staff, subscribers, API calls")

        print(f"\n✅ Created {3} service plan templates\n")

        # ====================================================================
        # Summary
        # ====================================================================

        print("=" * 70)
        print("🎉 Seeding Complete!")
        print("=" * 70)
        print(f"\n📊 Summary:")
        print(f"  • {6} Feature Modules")
        print(f"  • {5} Quota Definitions")
        print(f"  • {3} Service Plan Templates")
        print(f"\n🌐 Access the API at: http://localhost:8000/api/v1/docs")
        print(f"📖 Read the guide: docs/COMPOSABLE_LICENSING_FRAMEWORK.md")
        print(f"\n✨ You can now:")
        print(f"  1. View plans: GET /api/v1/licensing/plans")
        print(f"  2. View modules: GET /api/v1/licensing/modules")
        print(f"  3. View quotas: GET /api/v1/licensing/quotas")
        print(f"  4. Create custom plans by mixing modules + quotas")
        print(f"  5. Subscribe tenants to plans")
        print("=" * 70)


if __name__ == "__main__":
    asyncio.run(seed_framework())
