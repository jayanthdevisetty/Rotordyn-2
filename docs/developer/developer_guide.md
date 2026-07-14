# Rotordyn.ai: Developer Guide

**Document Reference**: ROTORDYN-DG-1.0.0  
**Version**: 1.0.0-Beta  
**Date**: July 14, 2026  
**Author**: Engineering Enablement Group  
**Classification**: Internal Development Only  

---

## Document Control

### Revision History

| Version | Date | Author | Description |
| :--- | :--- | :--- | :--- |
| `0.9.0` | 2026-07-06 | Engineering Lead | Initial local setup manual and style guides. |
| `1.0.0` | 2026-07-14 | Solutions Architect | Added pytest runner specifications and Playwright integration scripts. |

---

## 1. Local Environment Setup

### 1.1 Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python**: v3.10.0 or higher
- **WSL (Optional)**: Needed if executing Playwright tests in Linux environments.

### 1.2 Frontend Setup
1. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
   The site will be available on `http://localhost:5000/`.

### 1.3 Backend Setup
1. Navigate to the root directory and create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Configure environment file `backend/.env` with Supabase keys:
   ```bash
   cp backend/.env.example backend/.env
   ```
4. Start the FastAPI server:
   ```bash
   python -m backend.main
   ```

---

## 2. Repository Structure

```
rotordyn-ai-v2/
├── backend/
│   ├── alembic/        # Alembic DB migrations
│   ├── routes/         # FastAPI endpoints (auth, alarms)
│   ├── tests/          # Pytest unit files
│   ├── middleware.py   # HTTP security filters
│   └── main.py         # App entrypoint
├── frontend/
│   ├── src/
│   │   ├── components/ # React components
│   │   └── pages/      # Dashboard and Auth pages
│   └── package.json
└── verify_ui.py        # Playwright verification script
```

---

## 3. Coding Standards & Best Practices

### 3.1 Hoisting Dynamic UI Variables
Due to React mounting cycles, all interactive state variables (like `df`, `bearingPairs`, `plotSlots`, `timelinePlotlyContainer`) must be declared in the **global module scope** in `Dashboard.jsx`. Modifying them inside Hooks must assign to global references without re-declaring them locally.

### 3.2 Security Headers Enforcement
CORS exceptions should strictly match exact origins in production. Regular expression subnet matching (`allow_origin_regex`) is disabled when `ENV=production` inside [main.py](../../backend/main.py#L111-L121).

---

## 4. Testing & Verification

### 4.1 Running Backend Tests
Execute unit and RBAC middleware validation tests:
```bash
python backend/tests/run_tests.py
```

### 4.2 Running Playwright Tests
To verify auth guards and redirects on the browser client:
```bash
python3 verify_ui.py
```
Ensure the development servers are active on ports `5000` and `8000` before running.
