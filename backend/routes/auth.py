from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from typing import List
from datetime import datetime
import httpx
from jose import jwt, JWTError
import stripe
import os
from models.user import UserRegister, UserLogin, UserResponse, Token
from database import supabase, log_audit_action
from config import settings

router = APIRouter(prefix="/auth", tags=["auth"])
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

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
        "subscription_status": profile.get("subscription_status", "free-tier"),
        "report_generation_count": int(profile.get("report_generation_count", 0)),
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
                    "subscription_status": metadata.get("subscription_status", "free-tier"),
                    "report_generation_count": int(metadata.get("report_generation_count", 0))
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
                        "subscription_status": metadata.get("subscription_status", "free-tier"),
                        "report_generation_count": int(metadata.get("report_generation_count", 0))
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
            user_data["subscription_status"] = profile.get("subscription_status") or user_data.get("subscription_status") or "free-tier"
            user_data["report_generation_count"] = int(profile.get("report_generation_count") if profile.get("report_generation_count") is not None else user_data.get("report_generation_count", 0))
            user_data["company"] = profile.get("company", user_data["company"])
            user_data["plant"] = profile.get("plant", user_data["plant"])
            user_data["name"] = profile.get("name", user_data["name"])
            user_data["purpose"] = profile.get("purpose", user_data["purpose"])
            user_data["created_at"] = profile.get("created_at")
    except Exception as e:
        print(f"Error checking user profile status: {e}")
        # fallback to token data if database is down
        user_data["subscription_status"] = "free-tier"
        user_data["report_generation_count"] = 0
        
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

def check_role(allowed_roles: List[str]):
    """Dependency to check if the current approved user's role is in the allowed list."""
    async def role_dependency(current_user: dict = Depends(get_current_approved_user)):
        # Enterprise Roles: Owner, Admin, Manager, Engineer, Viewer, Billing, Support
        # Handle case-insensitive comparison
        user_role = current_user.get("role", "Viewer")
        # Treat role as case-insensitive to avoid string match failures
        matched = any(user_role.lower() == role.lower() for role in allowed_roles)
        # Treat admin as owner-equivalent
        if user_role.lower() == "admin":
            matched = True
        if not matched:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. User role '{user_role}' lacks permissions for this operation."
            )
        return current_user
    return role_dependency

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
            
        try:
            from services.email_service import send_access_request_email
            asyncio.create_task(
                send_access_request_email(
                    user_name=user_in.name,
                    user_email=user_in.email,
                    company=user_in.company,
                    plant=user_in.plant,
                    purpose=user_in.purpose or ""
                )
            )
        except Exception as e:
            print(f"Error triggering access request email: {e}")
            
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

@router.post("/upgrade_subscription", response_model=UserResponse)
async def upgrade_subscription(current_user: dict = Depends(get_current_approved_user)):
    """Upgrades the current user to premium status via the mock payment checkout integration."""
    try:
        try:
            supabase.table("profiles").update({"subscription_status": "premium"}).eq("id", current_user["id"]).execute()
        except Exception as e:
            print(f"Skipping profiles table subscription_status update: {e}")
            pass
            
        try:
            supabase.auth.admin.update_user_by_id(
                current_user["id"],
                {"user_metadata": {"subscription_status": "premium"}}
            )
        except Exception as e:
            print(f"Auth metadata update failed: {e}")
            pass
            
        db_res = supabase.table("profiles").select("*").eq("id", current_user["id"]).execute()
        if db_res.data and len(db_res.data) > 0:
            user_info = serialize_user(db_res.data[0])
            user_info["subscription_status"] = "premium"
            return user_info
            
        current_user["subscription_status"] = "premium"
        return current_user
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Subscription upgrade failed: {str(e)}"
        )

@router.post("/create_checkout_session")
async def create_checkout_session(origin: str, current_user: dict = Depends(get_current_approved_user)):
    """Creates a real Stripe Checkout Session for Premium Analyst license."""
    stripe_key = os.getenv("STRIPE_SECRET_KEY")
    if not stripe_key:
        return {"stripe_active": False, "msg": "Stripe is not configured in environment variables. Sandbox mode will be used."}
        
    try:
        stripe.api_key = stripe_key
        # Create checkout session
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': 'Premium Analyst Plan',
                        'description': 'Unlimited telemetry uploads, WebGL 3D waterfall analysis, and PDF/Word evidence exports.',
                    },
                    'unit_amount': 19900,  # $199.00 USD
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{origin}/subscription?session_id={{CHECKOUT_SESSION_ID}}&success=true",
            cancel_url=f"{origin}/subscription?canceled=true",
            metadata={
                'user_id': current_user['id']
            }
        )
        return {"stripe_active": True, "url": session.url}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Stripe Checkout session: {str(e)}"
        )

@router.post("/verify_checkout_session")
async def verify_checkout_session(session_id: str, current_user: dict = Depends(get_current_approved_user)):
    """Verifies a Stripe Checkout Session status and upgrades the user to premium if successful."""
    stripe_key = os.getenv("STRIPE_SECRET_KEY")
    if not stripe_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stripe is not configured. Cannot verify payment."
        )
        
    try:
        stripe.api_key = stripe_key
        session = stripe.checkout.Session.retrieve(session_id)
        
        # Security Hardening: Ensure session user metadata matches logged-in user to prevent replay sharing
        session_user_id = session.metadata.get('user_id')
        if not session_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Checkout session metadata is missing user identification."
            )
            
        if session_user_id != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Stripe Checkout Session owner mismatch. Upgrade request denied."
            )

        if session.payment_status == 'paid':
            # Upgrade user in supabase profiles
            try:
                supabase.table("profiles").update({"subscription_status": "premium"}).eq("id", current_user["id"]).execute()
            except Exception as e:
                print(f"Skipping profiles table status update in verify: {e}")
                pass
                
            # Upgrade user metadata
            try:
                supabase.auth.admin.update_user_by_id(
                    current_user["id"],
                    {"user_metadata": {"subscription_status": "premium"}}
                )
            except Exception as e:
                print(f"Auth metadata update failed in verify: {e}")
                pass
                
            # Log audit trail
            log_audit_action(
                user_id=current_user["id"],
                action="SUBSCRIPTION_UPGRADED_DIRECT",
                details={"session_id": session_id, "status": "premium"}
            )

            db_res = supabase.table("profiles").select("*").eq("id", current_user["id"]).execute()
            if db_res.data and len(db_res.data) > 0:
                user_info = serialize_user(db_res.data[0])
                user_info["subscription_status"] = "premium"
                return {"status": "success", "user": user_info}
                
            current_user["subscription_status"] = "premium"
            return {"status": "success", "user": current_user}
        else:
            return {"status": "pending", "payment_status": session.payment_status}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification failed: {str(e)}"
        )

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Secure Stripe webhook listener verifying signatures to process async checkout completions."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    if not sig_header or not webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stripe webhook configuration or signature is missing."
        )

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        # Invalid payload
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe payload."
        )
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stripe signature verification failed."
        )

    # Handle the checkout.session.completed event
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.metadata.get("user_id")
        
        if user_id:
            print(f"INFO: Processing Stripe webhook upgrade for user_id: {user_id}")
            try:
                # 1. Update Database Profile status
                supabase.table("profiles").update({"subscription_status": "premium"}).eq("id", user_id).execute()
            except Exception as e:
                print(f"ERROR: Webhook DB profile status update failed: {e}")

            try:
                # 2. Update Supabase User Auth Metadata
                supabase.auth.admin.update_user_by_id(
                    user_id,
                    {"user_metadata": {"subscription_status": "premium"}}
                )
            except Exception as e:
                print(f"ERROR: Webhook Auth metadata update failed: {e}")

            # Log audit action
            log_audit_action(
                user_id=user_id,
                action="SUBSCRIPTION_UPGRADED_WEBHOOK",
                details={"session_id": session.get("id")}
            )

    return {"status": "success"}
