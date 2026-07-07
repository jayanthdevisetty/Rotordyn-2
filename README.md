# Rotordyn.ai — Vibration Analysis SaaS MVP

This project wraps the high-end, browser-side Plotly-based turbomachinery vibration diagnostic dashboard with a modular full-stack SaaS model. It includes secure JWT-based authentication, an administrator user approval queue, MongoDB database storage, file uploads logs, and SMTP notifications sending uploaded `.csv`/`.xlsx` files as email attachments.

---

## Tech Stack Overview

* **Backend**: Python FastAPI (modular layout: configuration, database, routes, background email services)
* **Frontend**: Pure Static HTML/CSS/JS (no framework compilation required, fully compatible with Netlify)
* **Database**: MongoDB (async communication via `motor`)
* **Email notifications**: SMTP via Gmail App Passwords
* **Sessions**: JSON Web Tokens (JWT) with password hashing via `bcrypt`

---

## Getting Started: Local Setup

### 1. Database (MongoDB) Setup
Make sure MongoDB is running locally on your computer:
* Default local URL: `mongodb://127.0.0.1:27017/rotordyn`
* If using a remote cloud instance (MongoDB Atlas), see the **MongoDB Atlas Setup** section below.

### 2. Backend Setup
1. Navigate to the code root directory.
2. Install python dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Create your `.env` configuration file inside the `backend/` directory by copying `.env.example`:
   ```bash
   cp backend/.env.example backend/.env
   ```
4. Update the values in `backend/.env` with your actual MongoDB URI, JWT Secret, and Gmail App Password.
5. Run the **Admin Account Seed Script** to populate the system administrator account:
   ```bash
   python backend/scripts/create_admin.py
   ```
6. Start the FastAPI development server:
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   The backend API will be running at `http://localhost:8000`. You can inspect the interactive OpenAPI docs at `http://localhost:8000/docs`.

### 3. Frontend Setup
The frontend is composed of static assets inside the `frontend/` directory. For local testing, serve the files from a static server to bypass browser origin blocks:
1. In a new terminal, navigate to the `frontend/` directory:
   ```bash
   cd frontend/
   ```
2. Serve the static pages using Python:
   ```bash
   python -m http.server 5000
   ```
3. Open your browser and navigate to `http://localhost:5000` to access the landing page.

---

## Gmail App Password Setup (SMTP Attachments)

To allow the FastAPI backend to send email notifications automatically upon file upload:
1. Go to your Google Account Settings -> **Security**.
2. Enable **2-Step Verification** if not already active.
3. Search for or select **App Passwords** at the bottom of the section.
4. Generate a new password by selecting **Other (Custom Name)** and type `Rotordyn SaaS`.
5. Copy the generated 16-character code (e.g. `vgrtyjnrmxupecsa`).
6. Place this code as `GMAIL_APP_PASSWORD` in your `backend/.env` configuration. Ensure `GMAIL_USERNAME` is set to your Gmail address.

---

## MongoDB Atlas Cloud Setup

For production database storage:
1. Register/Login at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free M0 Shared Cluster.
3. Under **Database Access**, create a user with read/write privileges (choose password authentication).
4. Under **Network Access**, add an IP access rule. For production Web Service access (e.g., Render), add `0.0.0.0/0` (allow access from anywhere).
5. Copy the connection string (under Connect -> Drivers) and place it as `MONGODB_URI` in your production environments.

---

## Deployment Instructions

### 1. Render Deployment (FastAPI Backend)
1. Commit your codebase to a GitHub or GitLab repository.
2. Sign in to [Render](https://render.com).
3. Click **New +** and select **Web Service**.
4. Link your code repository.
5. Set the build environment settings:
   * **Runtime**: `Python`
   * **Root Directory**: (Keep empty, or point to your repository root)
   * **Build Command**: `pip install -r backend/requirements.txt`
   * **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
6. Add the required environment variables in the **Environment** settings tab (matching `.env.example`). Set `FRONTEND_URL` to your Netlify site URL to allow CORS.

⚠️ **WARNING on Local Storage**: For this MVP, uploaded vibration files are stored in the local `backend/uploads/` directory. Files stored on Render's local disk are ephemeral and will be lost when the Web Service restarts. For production environments, the code should be updated to save upload streams to permanent cloud storage (such as **Supabase Storage** or **Amazon S3**).

### 2. Netlify Deployment (Static Frontend)
1. Sign in to [Netlify](https://www.netlify.com).
2. Select **Add new site** -> **Deploy manually**.
3. Drag and drop the `frontend/` directory directly into the Netlify upload box.
4. Once deployed, note your Netlify URL (e.g., `https://rotordyn-saas.netlify.app`).
5. Set this URL as the `FRONTEND_URL` variable in your Render backend settings to whitelist CORS.

*Note: If your backend URL on Render changes, update the API address inside the JavaScript `<script>` blocks of `auth.html`, `admin.html`, `pending.html`, and `dashboard.html` to point to your live Render endpoint.*
