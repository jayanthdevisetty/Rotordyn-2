from fastapi import HTTPException
from routes.auth import check_role

async def test_check_role_allowed():
    # Setup roles check dependency
    dependency = check_role(["Admin", "Owner"])
    
    # Mock approved user dict
    user = {"role": "Owner", "status": "approved"}
    
    # Invoke dependency manually
    result = await dependency(user)
    assert result == user

async def test_check_role_denied():
    dependency = check_role(["Admin", "Owner"])
    user = {"role": "Engineer", "status": "approved"}
    
    raised = False
    try:
        await dependency(user)
    except HTTPException as exc:
        raised = True
        assert exc.status_code == 403
        assert "lacks permissions" in exc.detail
        
    assert raised, "Expected HTTPException to be raised but it wasn't"

async def test_check_role_admin_override():
    dependency = check_role(["Owner"])
    user = {"role": "admin", "status": "approved"} # lowercase admin
    
    # Admins are treated as owner-equivalent
    result = await dependency(user)
    assert result == user
