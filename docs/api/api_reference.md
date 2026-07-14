# Rotordyn.ai: API Reference

**Document Reference**: ROTORDYN-API-1.0.0  
**Version**: 1.0.0-Beta  
**Date**: July 14, 2026  
**Author**: Technical Writing Group  
**Classification**: Enterprise Confidential  

---

## Document Control

### Revision History

| Version | Date | Author | Description |
| :--- | :--- | :--- | :--- |
| `0.9.0` | 2026-07-06 | Tech Writer | Initial endpoint schemas and request payloads definition. |
| `1.0.0` | 2026-07-14 | Solutions Architect | Added Stripe checkout session verification and Prometheus metrics APIs. |

---

## 1. Authentication Endpoints

### 1.1 POST `/auth/login`
- **Purpose**: Authenticates user credentials with Supabase and returns a JWT token.
- **Authentication**: None.
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "analyst@company.com",
    "password": "secure_password"
  }
  ```
- **Response Headers**: `Strict-Transport-Security`, `Content-Security-Policy`
- **Response (200 OK)**:
  ```json
  {
    "access_token": "eyJhbGciOiJFUzI1NiIs...",
    "token_type": "bearer"
  }
  ```
- **Error Codes**:
  - `401 Unauthorized`: "Incorrect email or password."

---

### 1.2 POST `/auth/create_checkout_session`
- **Purpose**: Creates a Stripe checkout session URL for Premium upgrades.
- **Authentication**: JWT Bearer Token.
- **Request Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**:
  ```json
  {
    "stripe_active": true,
    "url": "https://checkout.stripe.com/c/pay/..."
  }
  ```

---

## 2. Telemetry Ingestion Endpoints

### 2.1 POST `/uploads`
- **Purpose**: Records metadata of files streamed directly to Supabase storage.
- **Authentication**: JWT Bearer Token (Status must be "approved").
- **Request Body**:
  ```json
  {
    "original_filename": "vibration_telemetry.csv",
    "stored_filename": "guid_merged_file.csv",
    "file_url": "https://supabase-bucket.co/vibration_telemetry.csv",
    "file_size": 1542000
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "id": "upload-uuid-123",
    "original_filename": "vibration_telemetry.csv",
    "file_path": "https://supabase-bucket.co/vibration_telemetry.csv",
    "analysis_status": "completed"
  }
  ```

---

## 3. Industrial Alarm Endpoints

### 3.1 POST `/alarms/trigger`
- **Purpose**: Records threshold alert violations in database logs.
- **Authentication**: JWT Bearer Token.
- **Request Body**:
  ```json
  {
    "bearing_name": "BRG1",
    "severity": "critical",
    "message": "Bearing peak amplitude exceeds 3.5 mils threshold.",
    "value": 3.72
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "id": "alarm-uuid-456",
    "bearing_name": "BRG1",
    "severity": "critical",
    "status": "active"
  }
  ```

---

## 4. Monitoring & Metrics Endpoints

### 4.1 GET `/metrics`
- **Purpose**: Exposes Prometheus-compatible operational statistics.
- **Authentication**: None.
- **Response Media Type**: `text/plain`
- **Response (200 OK)**:
  ```text
  # HELP rotordyn_http_requests_total Total number of HTTP requests
  # TYPE rotordyn_http_requests_total counter
  rotordyn_http_requests_total{method="POST",path="/auth/login",status="200"} 42
  ```
