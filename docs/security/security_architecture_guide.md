# Rotordyn.ai: Security Architecture Guide

**Document Reference**: ROTORDYN-SAG-1.0.0  
**Version**: 1.0.0-Beta  
**Date**: July 14, 2026  
**Author**: Security Architecture Group  
**Classification**: Enterprise Confidential  

---

## Document Control

### Revision History

| Version | Date | Author | Description |
| :--- | :--- | :--- | :--- |
| `0.9.0` | 2026-07-06 | Security Architect | Initial threat model and encryption blueprints. |
| `1.0.0` | 2026-07-14 | Solutions Architect | Added Stripe webhook signature parsing and CSP validation parameters. |

---

## 1. Threat Model & OWASP Top 10 Mitigation Matrix

The application implements active security controls targeting the OWASP Top 10:

| OWASP Category | Implemented Mitigation | Verification Mechanism |
| :--- | :--- | :--- |
| **A01:2021-Broken Access Control** | Enforced checking via `check_role` matching client claims against Postgres profiles. | Automated RBAC permission test suite. |
| **A03:2021-Injection** | Parametric DB execution structures and Pydantic request body validation schemas. | Database drivers enforce query boundaries. |
| **A05:2021-Security Misconfiguration** | Custom security headers: HSTS, CSP, X-Frame-Options (DENY), nosniff. | Verified live header parameters. |
| **A07:2021-Identification & Auth** | Supabase JWT token verification, strict role state checks on profiles. | `get_current_approved_user` dependency. |

---

## 2. API Security Hardening Middleware

All HTTP responses are injected with security parameters inside [middleware.py](../../backend/middleware.py#L155-L170):

```python
response.headers["X-Content-Type-Options"] = "nosniff"
response.headers["X-Frame-Options"] = "DENY"
response.headers["X-XSS-Protection"] = "1; mode=block"
response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
```
The CSP header whitelists static assets and limits backend websocket endpoints exclusively to `ws://` and `wss://` origins.

---

## 3. Stripe Webhook & Signature Verification

To defend against subscription replay attacks and fake checkout actions, Webhooks are verified using cryptographic signatures inside [auth.py](../../backend/routes/auth.py#L519-L548):

```python
event = stripe.Webhook.construct_event(
    payload, sig_header, webhook_secret
)
```
If the signature verification checks fail, the application rejects the request immediately, returning a `400 Bad Request` code.

---

## 4. Audit Log Persistence

All system-critical state mutations are logged persistently using `log_audit_action()` inside [database.py](../../backend/database.py#L60-L88):
- User Logins: Mapped under action `USER_LOGIN`.
- Telemetry Uploads: Mapped under action `UPLOAD_DATASET`.
- Alarms Acknowledged: Mapped under action `ALARM_ACKNOWLEDGED`.
- Subscription upgrades: Mapped under action `SUBSCRIPTION_UPGRADED_WEBHOOK`.

Audit log entries record the user's IP address, timestamp, action type, and JSON metadata payload.
