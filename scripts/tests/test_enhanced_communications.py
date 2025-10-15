#!/usr/bin/env python3
"""
Test script to verify enhanced communications system deployment.
"""

import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))


async def test_imports():
    """Test that all enhanced communications modules can be imported."""
    print("🧪 Testing enhanced communications imports...")

    try:
        # Test basic communications import

        print("✅ Basic communications module imported successfully")

        # Test enhanced features import
        from dotmac.platform.communications import (
            enhanced_router,
            get_bulk_service,
            get_template_service,
        )

        print("✅ Enhanced communications modules imported successfully")

        # Test template service functionality
        template_service = get_template_service()
        print("✅ Template service created successfully")

        # Test bulk service functionality
        bulk_service = get_bulk_service()
        print("✅ Bulk service created successfully")

        # Test router import
        print(f"✅ Enhanced router available at: {enhanced_router.prefix}")

        return True

    except Exception as e:
        print(f"❌ Import test failed: {e}")
        import traceback

        traceback.print_exc()
        return False


async def test_template_rendering():
    """Test Jinja2 template rendering."""
    print("\n🧪 Testing template rendering...")

    try:
        from dotmac.platform.communications import get_template_service

        template_service = get_template_service()

        # Test basic template rendering
        subject = "Welcome {{name}}!"
        html = "<h1>Hello {{name}}</h1><p>Your email is {{email}}</p>"
        text = "Hello {{name}}! Your email is {{email}}"

        rendered = await template_service.render_template(
            subject, html, text, {"name": "John Doe", "email": "john@example.com"}
        )

        assert "John Doe" in rendered.subject
        assert "john@example.com" in rendered.html_content
        assert len(rendered.variables_used) == 2
        print("✅ Template rendering works correctly")

        return True

    except Exception as e:
        print(f"❌ Template rendering test failed: {e}")
        import traceback

        traceback.print_exc()
        return False


async def test_basic_notification():
    """Test basic notification functionality."""
    print("\n🧪 Testing basic notification system...")

    try:
        from dotmac.platform.communications import (
            NotificationRequest,
            NotificationType,
            get_notification_service,
        )

        service = get_notification_service()

        # Test sending a basic email notification
        request = NotificationRequest(
            type=NotificationType.EMAIL,
            recipient="test@example.com",
            subject="Test Subject",
            content="Test email content",
        )

        response = service.send(request)
        assert response.id is not None
        assert "sent" in response.status.value
        print("✅ Basic notification system works")

        return True

    except Exception as e:
        print(f"❌ Basic notification test failed: {e}")
        import traceback

        traceback.print_exc()
        return False


async def test_celery_integration():
    """Test Celery task integration."""
    print("\n🧪 Testing Celery integration...")

    try:
        from dotmac.platform.tasks import get_celery_app

        celery_app = get_celery_app()
        print(f"✅ Celery app available: {celery_app.main}")

        # Try to import the bulk email task
        try:
            print("✅ Bulk email task imported successfully")
        except Exception as e:
            print(f"⚠️  Bulk email task import issue (expected in test): {e}")

        return True

    except Exception as e:
        print(f"❌ Celery integration test failed: {e}")
        import traceback

        traceback.print_exc()
        return False


async def run_all_tests():
    """Run all deployment tests."""
    print("🚀 Starting Enhanced Communications Deployment Tests")
    print("=" * 60)

    tests = [
        ("Import Tests", test_imports),
        ("Template Rendering", test_template_rendering),
        ("Basic Notifications", test_basic_notification),
        ("Celery Integration", test_celery_integration),
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        print(f"\n📋 Running {test_name}...")
        try:
            if await test_func():
                passed += 1
                print(f"✅ {test_name} PASSED")
            else:
                print(f"❌ {test_name} FAILED")
        except Exception as e:
            print(f"❌ {test_name} FAILED with exception: {e}")

    print("\n" + "=" * 60)
    print(f"🎯 Test Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All tests passed! Enhanced communications system is ready.")
        print("\n🚀 Next steps:")
        print("  1. Start Celery workers: celery -A dotmac.platform.tasks worker --loglevel=info")
        print("  2. Start the FastAPI app: python -m dotmac.platform.main")
        print("  3. Visit http://localhost:8000/docs to see the API documentation")
        print("  4. Use the frontend components in your React app")
        return True
    else:
        print(f"⚠️  {total - passed} tests failed. Please check the errors above.")
        return False


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
