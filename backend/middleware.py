import time
import uuid
import sys
import os
import traceback
from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from jose import jwt
from database import log_audit_action
from config import settings
from utils.metrics import metrics_collector

# In-memory simple token-bucket rate limiter
# Key: client IP, Value: (tokens, last_update_time)
RATE_LIMIT_TOKENS = 100.0  # max tokens
RATE_LIMIT_REFILL_RATE = 2.0  # tokens per second
client_buckets = {}

def is_rate_limited(ip_address: str) -> bool:
    """Checks if the given IP address has exceeded the rate limit threshold."""
    now = time.time()
    if ip_address not in client_buckets:
        client_buckets[ip_address] = (RATE_LIMIT_TOKENS, now)
        return False
        
    tokens, last_update = client_buckets[ip_address]
    # Refill tokens based on elapsed time
    elapsed = now - last_update
    new_tokens = min(RATE_LIMIT_TOKENS, tokens + elapsed * RATE_LIMIT_REFILL_RATE)
    
    if new_tokens < 1.0:
        client_buckets[ip_address] = (new_tokens, now)
        return True
        
    client_buckets[ip_address] = (new_tokens - 1.0, now)
    return False

class SecurityAndLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # 1. Generate Request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # 2. Extract Client IP
        ip_address = request.client.host if request.client else "unknown"
        
        # 3. Rate Limiting (Skip rate limiting for health check endpoint to prevent telemetry degradation)
        if request.url.path != "/health" and is_rate_limited(ip_address):
            log_audit_action(
                user_id="00000000-0000-0000-0000-000000000000",
                action="RATE_LIMIT_EXCEEDED",
                details={"path": request.url.path, "ip": ip_address}
            )
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Rate limit exceeded. Please wait and try again later.", "request_id": request_id}
            )

        # Extract User ID from JWT if present for structured logging audits
        user_id = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                # Read claim sub (Supabase user ID) without checking signature at middleware level
                claims = jwt.get_unverified_claims(token)
                user_id = claims.get("sub")
            except Exception:
                pass

        # Attach request context to Sentry scope dynamically if configured
        if os.getenv("SENTRY_DSN"):
            try:
                import sentry_sdk
                with sentry_sdk.configure_scope() as scope:
                    scope.set_tag("request_id", request_id)
                    if user_id:
                        scope.set_user({"id": user_id})
            except Exception:
                pass

        try:
            response = await call_next(request)
        except Exception as exc:
            # 4. Global Exception Handler / Fail-Safe Rollback
            process_time = int((time.time() - start_time) * 1000)
            tb = traceback.format_exc()
            
            # Send exception directly to Sentry if active
            if os.getenv("SENTRY_DSN"):
                try:
                    import sentry_sdk
                    sentry_sdk.capture_exception(exc)
                except Exception:
                    pass

            # Print structured JSON log to stdout
            error_log = {
                "timestamp": time.time(),
                "request_id": request_id,
                "user_id": user_id or "unauthenticated",
                "method": request.method,
                "path": request.url.path,
                "ip": ip_address,
                "latency_ms": process_time,
                "status_code": 500,
                "error": str(exc),
                "traceback": tb.splitlines()[-5:] # last few lines
            }
            print(f"CRITICAL: {error_log}", file=sys.stderr)
            
            # Write secure audit log
            log_audit_action(
                user_id=user_id or "00000000-0000-0000-0000-000000000000",
                action="SERVER_INTERNAL_ERROR",
                details={"path": request.url.path, "error": str(exc), "request_id": request_id},
                ip_address=ip_address
            )
            
            # Record metrics
            metrics_collector.record_request(request.method, request.url.path, 500)
            metrics_collector.record_duration(process_time)
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "detail": "An internal server error occurred. Please contact system support.",
                    "request_id": request_id
                }
            )

        # 5. Calculate Latency
        process_time = int((time.time() - start_time) * 1000)
        
        # Record metrics
        metrics_collector.record_request(request.method, request.url.path, response.status_code)
        metrics_collector.record_duration(process_time)

        # 6. Structured request log
        req_log = {
            "timestamp": time.time(),
            "request_id": request_id,
            "user_id": user_id or "unauthenticated",
            "method": request.method,
            "path": request.url.path,
            "ip": ip_address,
            "status_code": response.status_code,
            "latency_ms": process_time
        }
        print(f"INFO: {req_log}")

        # 7. Apply Security Hardening Headers (CSP, HSTS, X-Content-Type, X-Frame)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        
        # CSP Header permitting self origins and necessary external asset CDNs
        response.headers["Content-Security-Policy"] = (
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://*.googleapis.com ws://*; "
            "img-src 'self' data: https://*; "
            "media-src 'self' data: https://*;"
        )
        
        return response
