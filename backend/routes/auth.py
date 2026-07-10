from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import List
from datetime import datetime
import httpx
from jose import jwt, JWTError
from models.user import UserRegister, UserLogin, UserResponse, Token
from database import supabase, log_audit_action
from config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def serialize_user(profile) -> dict:
    """Helper to convert Supabase profile record to standard user format."""
    # Ensure created_at is converted to string/isoformat if it is a datetime or string
    created_at = profile.get("created_at")
    if isinstance(created_at, datetime):
        created_at_val = created_at
    elif isinstance(created_at, str):
        try:
            # Strip timezone Z or offsets to match fastapi iso format
            created_at_val = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except Exception:
            created_at_val = datetime.utcnow()
    else:
        created_at_val = datetime.utcnow()

    return {
        "id": str(profile.get("id")),
        "name": profile.get("name", ""),
        "email": profile.get("email", ""),
        "company": profile.get("company", "Default Company"),
        "plant": profile.get("plant", "Default Plant"),
        "purpose": profile.get("purpose", ""),
        "role": profile.get("role", "user"),
        "status": profile.get("status", "pending"),
        "subscription_status": profile.get("subscription_status", "free"),
        "created_at": created_at_val
    }

async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Dependency to retrieve the currently logged-in user from the Supabase JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    user_data = None
    
    # Method 1: Decode locally if SUPABASE_JWT_SECRET is set
    if settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(token, settings.SUPABASE_JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
            email = payload.get("email")
            sub = payload.get("sub") # user UUID
            metadata = payload.get("user_metadata", {})
            if email and sub:
                user_data = {
                    "id": sub,
                    "email": email,
                    "name": metadata.get("name", ""),
                    "company": metadata.get("company", "Default Company"),
                    "plant": metadata.get("plant", "Default Plant"),
                    "purpose": metadata.get("purpose", ""),
                    "role": metadata.get("role", "user"),
                    "status": metadata.get("status", "pending"),
                    "subscription_status": metadata.get("subscription_status", "free")
                }
        except JWTError:
            pass
            
    # Method 2: Call Supabase Auth endpoint as fallback (no JWT secret required)
    if not user_data:
        try:
            url = f"{settings.SUPABASE_URL}/auth/v1/user"
            headers = {
                "Authorization": f"Bearer {token}",
                "apikey": settings.SUPABASE_ANON_KEY
            }
            async with httpx.AsyncClient() as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    metadata = data.get("user_metadata", {})
                    user_data = {
                        "id": data.get("id"),
                        "email": data.get("email"),
                        "name": metadata.get("name", ""),
                        "company": metadata.get("company", "Default Company"),
                        "plant": metadata.get("plant", "Default Plant"),
                        "purpose": metadata.get("purpose", ""),
                        "role": metadata.get("role", "user"),
                        "status": metadata.get("status", "pending"),
                        "subscription_status": metadata.get("subscription_status", "free")
                    }
        except Exception as e:
            print(f"Token verification fallback failed: {e}")
            pass
            
    if not user_data:
        raise credentials_exception
        
    # To prevent outdated JWT tokens, query the profiles table in Supabase Postgres directly
    try:
        db_res = supabase.table("profiles").select("*").eq("id", user_data["id"]).execute()
        if db_res.data and len(db_res.data) > 0:
            profile = db_res.data[0]
            user_data["role"] = profile.get("role", user_data["role"])
            user_data["status"] = profile.get("status", user_data["status"])
            user_data["subscription_status"] = profile.get("subscription_status", "free")
            user_data["company"] = profile.get("company", user_data["company"])
            user_data["plant"] = profile.get("plant", user_data["plant"])
            user_data["name"] = profile.get("name", user_data["name"])
            user_data["purpose"] = profile.get("purpose", user_data["purpose"])
            user_data["created_at"] = profile.get("created_at")
    except Exception as e:
        print(f"Error checking user profile status: {e}")
        # fallback to token data if database is down
        user_data["subscription_status"] = "free"
        
    return user_data

async def get_current_approved_user(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency to ensure the current user's status is approved."""
    if current_user["status"] == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending admin approval."
        )
    elif current_user["status"] == "blocked":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been blocked by the administrator."
        )
    elif current_user["status"] == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account request has been rejected."
        )
    elif current_user["status"] != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted. Account is not approved."
        )
    return current_user

async def get_current_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency to ensure the current user is an admin."""
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required."
        )
    return current_user

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegister):
    """Registers a new user account in Supabase and inserts metadata into the profiles table."""
    try:
        # Check if email is already in profiles
        existing = supabase.table("profiles").select("id").eq("email", user_in.email).execute()
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already registered."
            )

        # 1. Sign up user in Supabase auth (creates user in auth.users)
        # Note: metadata defaults to pending approval
        sign_up_res = supabase.auth.sign_up({
            "email": user_in.email,
            "password": user_in.password,
            "options": {
                "data": {
                    "name": user_in.name,
                    "company": user_in.company,
                    "plant": user_in.plant,
                    "role": "user",
                    "status": "pending"
                }
            }
        })
        
        user = sign_up_res.user
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to register user in Supabase Auth."
            )
            
        # 2. Insert user details in profiles table
        profile_data = {
            "id": user.id,
            "name": user_in.name,
            "email": user_in.email,
            "company": user_in.company,
            "plant": user_in.plant,
            "purpose": user_in.purpose or "",
            "role": "user",
            "status": "pending"
        }
        
        db_res = supabase.table("profiles").insert(profile_data).execute()
        if not db_res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user profile record in database."
            )
            
        return serialize_user(db_res.data[0])
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )

@router.post("/login", response_model=Token)
async def login(user_in: UserLogin):
    """Authenticates user with Supabase and returns a JWT token."""
    try:
        login_res = supabase.auth.sign_in_with_password({
            "email": user_in.email,
            "password": user_in.password
        })
        
        if not login_res.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password."
            )
            
        # Log successful login audit trail
        log_audit_action(login_res.user.id, "USER_LOGIN", {"email": user_in.email})
            
        return {
            "access_token": login_res.session.access_token,
            "token_type": "bearer"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )

@router.post("/{provider}/callback", response_model=Token)
async def oauth_callback(provider: str, body: dict):
    """Exchanges Supabase OAuth authorization code for a session token."""
    code = body.get("code")
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing authorization code from provider."
        )
    
    try:
        # Exchange PKCE auth code for a session
        res = supabase.auth.exchange_code_for_session({
            "auth_code": code
        })
        
        session = res.session
        user = res.user
        if not session or not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OAuth code exchange did not return a valid session."
            )
            
        # Ensure user profile exists in database
        existing = supabase.table("profiles").select("*").eq("id", user.id).execute()
        if not existing.data or len(existing.data) == 0:
            metadata = user.user_metadata or {}
            name = metadata.get("full_name") or metadata.get("name") or user.email.split("@")[0]
            
            profile_data = {
                "id": user.id,
                "name": name,
                "email": user.email,
                "company": "OAuth Registered",
                "plant": "Default Plant",
                "purpose": "Vibration Analysis",
                "role": "user",
                "status": "pending"
            }
            
            db_res = supabase.table("profiles").insert(profile_data).execute()
            if not db_res.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create user profile after OAuth registration."
                )
                
        # Log successful OAuth login audit trail
        log_audit_action(user.id, "USER_LOGIN_OAUTH", {"email": user.email, "provider": provider})
            
        return {
            "access_token": session.access_token,
            "token_type": "bearer"
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth exchange failed: {str(e)}"
        )

@router.get("/me", response_model=UserResponse)
async def read_current_user(current_user: dict = Depends(get_current_user)):
    """Returns the current user profile."""
    return current_user

@router.get("/team", response_model=List[UserResponse])
async def list_team_members(current_user: dict = Depends(get_current_approved_user)):
    """Retrieves list of colleagues belonging to the same company organization."""
    try:
        company = current_user.get("company")
        if not company or company == "OAuth Registered" or company == "Default Company":
            return [current_user]
            
        res = supabase.table("profiles").select("*").eq("company", company).execute()
        members = []
        for doc in res.data:
            members.append(serialize_user(doc))
        return members
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch team members: {str(e)}"
        )
