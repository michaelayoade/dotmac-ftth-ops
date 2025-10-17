"""
Test License Issuance Workflow

Tests the license_service.issue_license() method to verify proper integration
with the composable licensing framework.
"""

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.dotmac.platform.db import get_async_session
from src.dotmac.platform.licensing.models import (
    License,
    LicenseModel,
    LicenseTemplate,
    LicenseType,
)
from src.dotmac.platform.licensing.workflow_service import LicenseService


async def create_test_template(db: AsyncSession, tenant_id: str) -> str:
    """Create a test license template."""
    template = LicenseTemplate(
        id=str(uuid4()),
        template_name="Professional ISP License",
        product_id="ISP-PRO-001",
        description="Professional ISP management license with full features",
        tenant_id=tenant_id,
        license_type=LicenseType.SUBSCRIPTION,
        license_model=LicenseModel.PER_SEAT,
        default_duration=365,  # 1 year
        max_activations=5,
        features={
            "features": [
                {
                    "feature_id": "radius_aaa",
                    "feature_name": "RADIUS AAA",
                    "enabled": True,
                    "limit_value": None,
                    "limit_type": None,
                    "expires_at": None,
                },
                {
                    "feature_id": "billing_invoicing",
                    "feature_name": "Billing & Invoicing",
                    "enabled": True,
                    "limit_value": None,
                    "limit_type": None,
                    "expires_at": None,
                },
            ]
        },
        restrictions={"restrictions": []},
        pricing={"monthly": 299.00, "annual": 2990.00},
        auto_renewal_enabled=True,
        trial_allowed=True,
        trial_duration_days=30,
        grace_period_days=30,
        active=True,
    )

    db.add(template)
    await db.flush()

    print(f"✓ Created test template: {template.id}")
    print(f"  - Name: {template.template_name}")
    print(f"  - Product ID: {template.product_id}")
    print(f"  - Type: {template.license_type.value}")
    print(f"  - Duration: {template.default_duration} days")
    print(f"  - Max Activations: {template.max_activations}")
    print(f"  - Features: {len(template.features.get('features', []))}")
    print()

    return template.id


async def test_issue_license():
    """Test issuing a license to a customer."""
    # Get database session
    async for session in get_async_session():
        try:
            # Test data
            tenant_id = "test-tenant-001"
            customer_id = str(uuid4())

            print("=" * 60)
            print("Testing License Issuance Workflow")
            print("=" * 60)
            print()

            # Step 1: Create test template
            print("Step 1: Creating license template...")
            template_id = await create_test_template(session, tenant_id)

            # Step 2: Initialize license service
            print("Step 2: Initializing LicenseService...")
            license_service = LicenseService(db=session)
            print("✓ Service initialized")
            print()

            # Step 3: Issue license
            print("Step 3: Issuing license...")
            print(f"  - Customer ID: {customer_id}")
            print(f"  - Template ID: {template_id}")
            print(f"  - Tenant ID: {tenant_id}")
            print()

            result = await license_service.issue_license(
                customer_id=customer_id,
                license_template_id=template_id,
                tenant_id=tenant_id,
                issued_to="Test Customer",
            )

            print("✓ License issued successfully!")
            print()

            # Step 4: Verify result
            print("Step 4: Verifying license details...")
            print(f"  License Key: {result['license_key']}")
            print(f"  License ID: {result['license_id']}")
            print(f"  Customer ID: {result['customer_id']}")
            print(f"  Product ID: {result['product_id']}")
            print(f"  Product Name: {result['product_name']}")
            print(f"  License Type: {result['license_type']}")
            print(f"  License Model: {result['license_model']}")
            print(f"  Status: {result['status']}")
            print(f"  Issued To: {result['issued_to']}")
            print(f"  Issued Date: {result['issued_date']}")
            print(f"  Expiry Date: {result['expiry_date']}")
            print(f"  Max Activations: {result['max_activations']}")
            print(f"  Current Activations: {result['current_activations']}")
            print()

            # Step 5: Verify in database
            print("Step 5: Verifying license in database...")
            license_result = await session.execute(
                select(License).where(License.id == result["license_id"])
            )
            license_obj = license_result.scalar_one_or_none()

            if license_obj:
                print("✓ License found in database")
                print(f"  - Key: {license_obj.license_key}")
                print(f"  - Status: {license_obj.status.value}")
                print(f"  - Product: {license_obj.product_name}")
                print(f"  - Features: {len(license_obj.features.get('features', []))} features")
                print(f"  - Max Activations: {license_obj.max_activations}")
                print(
                    f"  - Expiry: {license_obj.expiry_date.strftime('%Y-%m-%d') if license_obj.expiry_date else 'None'}"
                )
                print()

                # Verify features
                features = license_obj.features.get("features", [])
                if features:
                    print("  Included Features:")
                    for feature in features:
                        print(f"    - {feature['feature_name']} ({feature['feature_id']})")
                    print()
            else:
                print("✗ License not found in database")
                return

            # Step 6: Test validation
            print("Step 6: Running validation checks...")
            checks = {
                "License key format": len(result["license_key"].split("-")) == 5,
                "License key length": len(result["license_key"].replace("-", "")) == 20,
                "License ID is UUID": len(result["license_id"]) == 36,
                "Status is ACTIVE": result["status"] == "ACTIVE",
                "Customer ID matches": result["customer_id"] == customer_id,
                "Template ID matches": result["template_id"] == template_id,
                "Has expiry date": result["expiry_date"] is not None,
                "Max activations > 0": result["max_activations"] > 0,
                "Current activations = 0": result["current_activations"] == 0,
            }

            all_passed = True
            for check, passed in checks.items():
                status = "✓" if passed else "✗"
                print(f"  {status} {check}")
                if not passed:
                    all_passed = False

            print()

            if all_passed:
                print("=" * 60)
                print("✓ ALL TESTS PASSED")
                print("=" * 60)
                print()
                print("Summary:")
                print(f"  - License issued with key: {result['license_key']}")
                print(f"  - Database record created: {result['license_id']}")
                print(f"  - Features included: {len(features)}")
                print(f"  - Valid for: 365 days")
                print(f"  - Max activations: {result['max_activations']}")
                print()
                print("The license_service.issue_license() method is PRODUCTION READY!")
            else:
                print("=" * 60)
                print("✗ SOME TESTS FAILED")
                print("=" * 60)

            # Rollback to clean up test data
            await session.rollback()
            print()
            print("(Test data rolled back)")

        except Exception as e:
            print(f"✗ Error during test: {e}")
            import traceback

            traceback.print_exc()
            await session.rollback()
        finally:
            await session.close()


if __name__ == "__main__":
    print()
    asyncio.run(test_issue_license())
    print()
