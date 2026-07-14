# Rotordyn.ai: Database Design Guide

**Document Reference**: ROTORDYN-DBG-1.0.0  
**Version**: 1.0.0-Beta  
**Date**: July 14, 2026  
**Author**: Data Architecture Group  
**Classification**: Enterprise Confidential  

---

## Document Control

### Revision History

| Version | Date | Author | Description |
| :--- | :--- | :--- | :--- |
| `0.9.0` | 2026-07-06 | Database Architect | Initial schema layouts and constraints definitions. |
| `1.0.0` | 2026-07-14 | Solutions Architect | Added startup schema checks and audit log tracking tables. |

---

## 1. Schema Specifications & Tables

All schemas are deployed in Supabase PostgreSQL:

### 1.1 `profiles` Table
- **Purpose**: Stores verified user identity records and workspace details.
- **Columns**:
  - `id`: `uuid` (Primary Key, matches Supabase `auth.users` identifier).
  - `email`: `varchar(255)` (Unique, Not Null).
  - `name`: `varchar(150)` (Not Null).
  - `company`: `varchar(150)` (Tenant identifier).
  - `plant`: `varchar(150)` (Sub-tenant identifier).
  - `role`: `varchar(50)` (Default: `user`).
  - `status`: `varchar(50)` (Default: `pending`).
  - `subscription_status`: `varchar(50)` (Default: `free-tier`).
  - `report_generation_count`: `integer` (Default: `0`).
  - `created_at`: `timestamp` (Default: `now()`).

### 1.2 `uploads` Table
- **Purpose**: Tracks vibration datasets uploaded to the system.
- **Columns**:
  - `id`: `uuid` (Primary Key).
  - `user_id`: `uuid` (Foreign Key -> `profiles.id`).
  - `company`: `varchar(150)`.
  - `plant`: `varchar(150)`.
  - `original_filename`: `varchar(255)`.
  - `stored_filename`: `varchar(255)`.
  - `file_url`: `text`.
  - `file_size`: `bigint`.
  - `upload_time`: `timestamp` (Default: `now()`).
  - `analysis_status`: `varchar(50)` (Default: `completed`).

### 1.3 `alarms` Table
- **Purpose**: Logs machine vibration threshold violations.
- **Columns**:
  - `id`: `uuid` (Primary Key).
  - `bearing_name`: `varchar(100)`.
  - `severity`: `varchar(50)`.
  - `message`: `text`.
  - `value`: `double precision`.
  - `status`: `varchar(50)` (Default: `active`).
  - `acknowledged_by`: `uuid` (Foreign Key -> `profiles.id`).
  - `acknowledged_at`: `timestamp`.

---

## 2. Constraints & Index Optimizations

### 2.1 Unique Constraints
- `profiles.email` is strictly unique to prevent duplicate account setups.

### 2.2 Performance Index Mappings
To optimize query performance for multi-tenant isolation filters:
- **`idx_profiles_company`**: B-Tree index on `profiles(company)` to locate team members quickly.
- **`idx_uploads_tenant`**: Composite B-Tree index on `uploads(company, plant)` to resolve historical dataset requests.
- **`idx_alarms_status`**: Partial B-Tree index on `alarms(status)` where `status = 'active'` to fetch warning logs instantly.

---

## 3. Migration Control (Alembic)

Database schemas are managed using Alembic. On application boot, FastAPI validates that the database is at the correct version inside [main.py](../../backend/main.py#L132-L137):
```python
@app.on_event("startup")
async def startup_event():
    if os.getenv("BYPASS_SCHEMA_VERIFICATION") != "true":
        verify_schema_version()
```
If version checks detect an outdated schema version, startup aborts.
