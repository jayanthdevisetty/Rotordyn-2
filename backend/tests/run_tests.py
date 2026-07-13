import asyncio
import sys
import os
from fastapi.testclient import TestClient

# Set search path to backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from routes.auth import get_current_approved_user
from tests.test_rbac_permissions import (
    test_check_role_allowed,
    test_check_role_denied,
    test_check_role_admin_override
)
from tests.test_alarms import (
    test_get_alarms_success,
    test_acknowledge_alarm_success
)

async def override_get_current_approved_user():
    return {
        "id": "user-456",
        "email": "test@rotordyn.ai",
        "name": "Test User",
        "company": "Default Company",
        "plant": "Default Plant",
        "purpose": "vibration analysis",
        "role": "Viewer",
        "status": "approved",
        "subscription_status": "free-tier",
        "report_generation_count": 0
    }

async def run_async_test(name, func):
    try:
        await func()
        print(f"PASS: {name}")
        return True
    except Exception as e:
        print(f"FAIL: {name} - {e}")
        return False

async def main_async():
    print("="*80)
    print("RODY CO-PILOT CUSTOM UNIT TEST RUNNER (SANDBOX COMPATIBLE)")
    print("="*80)
    
    success = True
    
    # Configure bypass environment settings
    os.environ["BYPASS_SCHEMA_VERIFICATION"] = "true"
    
    # 1. RBAC Tests
    success &= await run_async_test("test_check_role_allowed", test_check_role_allowed)
    success &= await run_async_test("test_check_role_denied", test_check_role_denied)
    success &= await run_async_test("test_check_role_admin_override", test_check_role_admin_override)
    
    # Apply dependency overrides for integration endpoints testing
    app.dependency_overrides[get_current_approved_user] = override_get_current_approved_user
    client = TestClient(app)
    
    # 2. Alarms REST Endpoint Tests
    success &= await run_async_test("test_get_alarms_success", lambda: test_get_alarms_success(client))
    success &= await run_async_test("test_acknowledge_alarm_success", lambda: test_acknowledge_alarm_success(client))
    
    # Clean up overrides
    app.dependency_overrides.clear()
    
    print("="*80)
    if success:
        print("ALL TESTS PASSED SUCCESSFULLY!")
        sys.exit(0)
    else:
        print("SOME TESTS FAILED.")
        sys.exit(1)

def main():
    asyncio.run(main_async())

if __name__ == "__main__":
    main()
