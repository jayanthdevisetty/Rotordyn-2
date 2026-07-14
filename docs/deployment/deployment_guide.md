# Rotordyn.ai: Deployment Guide

**Document Reference**: ROTORDYN-DG-1.0.0  
**Version**: 1.0.0-Beta  
**Date**: July 14, 2026  
**Author**: SRE & DevOps Group  
**Classification**: Enterprise Confidential  

---

## Document Control

### Revision History

| Version | Date | Author | Description |
| :--- | :--- | :--- | :--- |
| `0.9.0` | 2026-07-06 | SRE Engineer | Initial build containers mapping. |
| `1.0.0` | 2026-07-14 | Solutions Architect | Added edge header validations and health endpoint verification checklists. |

---

## 1. Docker Build Configuration

The backend is built inside a Docker container:
- Base: `python:3.11-slim`
- User: Creates a dedicated non-root execution group `appuser`.
- Commands:
  ```dockerfile
  # backend/Dockerfile
  FROM python:3.11-slim
  WORKDIR /app
  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  COPY . .
  RUN useradd -u 8888 appuser && chown -R appuser:appuser /app
  USER appuser
  EXPOSE 8000
  CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
  ```

---

## 2. Infrastructure Setup & Environment Mappings

Define the production parameters on the host instance:
- **`ENV`**: `production` (toggles regex CORS validation exceptions off).
- **`FRONTEND_URL`**: Whitelisted origin on backend.
- **`STRIPE_WEBHOOK_SECRET`**: Signature secret keys.
- **`SENTRY_DSN`**: Monitoring capture URL.

---

## 3. Production Sanity Verification Checklist

Upon deploying new version tags:
1. **Health Verification**:
   Query the `/health` endpoint to verify that PostgreSQL database state is connected:
   ```bash
   curl -I https://rotordyn-2.onrender.com/health
   ```
2. **Readiness Probe Check**:
   Confirm Kubernetes readiness probes return HTTP status code `200`:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" https://rotordyn-2.onrender.com/health/readiness
   ```
3. **Security Headers Validation**:
   Check that edge proxy response headers contain security blocks:
   ```bash
   curl -I https://rotordyn-2.vercel.app/auth
   ```
   Ensure HSTS (`Strict-Transport-Security`), CSP (`Content-Security-Policy`), X-Frame-Options (`DENY`), and X-Content-Type-Options (`nosniff`) headers are returned.
4. **Sentry Trigger Verification**:
   Trigger a simulated exception and verify that the traceback details are captured in Sentry without leaking raw secrets to the client:
   ```bash
   curl -X GET https://rotordyn-2.onrender.com/sentry-debug
   ```
   Must return HTTP status code `500` with JSON body payload containing `request_id`.
