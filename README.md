# Rotordyn.ai — Vibration Analysis & Diagnostics SaaS

Rotordyn.ai is a cloud-native vibration analysis and rotating machinery diagnostics SaaS platform. It ingests high-frequency telemetry data (centerline shaft orbit paths, time waveforms, FFT frequency spectrums, startup speed profiles) and generates engineering diagnostics reports.

---

## Technical Stack

- **Frontend**: React (Vite SPA) utilizing dynamic WebGL/Canvas graphics (Plotly.js, D3.js) and local browser uploader data caches (IndexedDB).
- **Backend**: FastAPI web server (Python 3.11) with global exception mappings and Prometheus metrics recorders.
- **Database**: Supabase PostgreSQL with Row-Level Security (RLS) policies and Alembic schema versioning.
- **Storage**: Supabase Storage buckets for secure telemetry uploads.
- **Payments**: Stripe Checkout Sessions with verified webhook signature hooks.
- **Monitoring**: Sentry exception capture integration and Prometheus metrics.

---

## Local Development Setup

### 1. Backend API Server Setup
1. Navigate to the root directory and create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   ```
2. Install Python dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Copy the environment variables template and configure your Supabase/Stripe/Sentry secret keys:
   ```bash
   cp .env.example backend/.env
   ```
4. Run migrations version checks and start the backend:
   ```bash
   python -m backend.main
   ```
   The backend API will run on `http://localhost:8000`. Exposes OpenAPI Swagger docs at `/docs`.

### 2. Frontend React Client Setup
1. Navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Copy env details:
   ```bash
   cp .env.example .env
   ```
4. Run the Vite developer server:
   ```bash
   npm run dev
   ```
   The client will serve on `http://localhost:5000`.

---

## Verification & Testing

### 1. Run Backend Unit Tests
Execute the unit and middleware RBAC test suite:
```bash
python backend/tests/run_tests.py
```

### 2. Run E2E Integration Tests
Assert auth guards, registration triggers, and path redirections using Playwright:
```bash
python3 verify_ui.py
```

---

## Production Release Documents
For full enterprise deployment details, consult the following manuals in the artifacts folder:
- **Architecture**: [sad_software_architecture_document.md](file:///C:/Users/shaik/.gemini/antigravity/brain/9b21ea1a-8a6a-45ed-84ae-d8df784b2cd2/sad_software_architecture_document.md)
- **Design Specifications**: [sdd_software_design_document.md](file:///C:/Users/shaik/.gemini/antigravity/brain/9b21ea1a-8a6a-45ed-84ae-d8df784b2cd2/sdd_software_design_document.md)
- **Operations & Runbooks**: [operations_runbook.md](file:///C:/Users/shaik/.gemini/antigravity/brain/9b21ea1a-8a6a-45ed-84ae-d8df784b2cd2/operations_runbook.md)
- **Security Guide**: [security_architecture_guide.md](file:///C:/Users/shaik/.gemini/antigravity/brain/9b21ea1a-8a6a-45ed-84ae-d8df784b2cd2/security_architecture_guide.md)
