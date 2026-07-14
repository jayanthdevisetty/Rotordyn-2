# Rotordyn.ai: Administrator Guide

**Document Reference**: ROTORDYN-AG-1.0.0  
**Version**: 1.0.0-Beta  
**Date**: July 14, 2026  
**Author**: Systems Operations Group  
**Classification**: Enterprise Confidential  

---

## Document Control

### Revision History

| Version | Date | Author | Description |
| :--- | :--- | :--- | :--- |
| `0.9.0` | 2026-07-06 | SRE Team | Initial user roles management guide. |
| `1.0.0` | 2026-07-14 | Solutions Architect | Added Stripe billing dashboard management and database log queries. |

---

## 1. Enterprise Role Management (RBAC)

The application supports three default roles:
- **`user`**: Basic access (Standard telemetry upload and visualizations).
- **`admin`**: System administrator (Privileges to review audit logs, modify subscription levels, and approve pending accounts).
- **`Owner`**: Organization owner.

### 1.1 Account Verification Workflow
When a new user signs up, their account defaults to a `pending` status.
1. The backend triggers a notification task:
   `INFO: Found pending user approvals. Sending reminder email to admin...`
2. The Admin logs in, navigates to the `/admin` workspace.
3. The Admin reviews the registrant's name, email, company, and purpose.
4. Clicking **Approve** updates the Postgres profile status column to `approved`. The user can now access dashboard features.

---

## 2. Subscription Billing & Plan Gates

Rotordyn.ai enforces two feature plans:
1. **Starter Plan (`free-tier`)**:
   - Limit: Restricted to **3 AI diagnostics reports** generation.
   - Limit Exhausted: Attempting to generate a 4th report prompts a billing block message:
     `You have reached the Starter Plan limit of 3 free AI diagnostics report generations. Please upgrade to a Premium subscription.`
2. **Premium Analyst (`premium`)**:
   - Unlocked: Unlimited file uploads, WebGL 3D waterfall analysis, and PDF exports.

---

## 3. Auditing Operational Activity Logs

To query security audit trails directly in the Supabase database:
```sql
SELECT created_at, user_id, action, details
FROM audit_logs
ORDER BY created_at DESC
LIMIT 100;
```
### 3.1 Key Security Actions
- **`USER_LOGIN_OAUTH`**: OAuth sign-ins.
- **`ALARM_ACKNOWLEDGED`**: Acknowledge bearing warnings.
- **`RATE_LIMIT_EXCEEDED`**: Brute-force block events.
