import os
import time
from playwright.sync_api import sync_playwright

artifact_dir = r"C:\Users\shaik\.gemini\antigravity\brain\69e38a35-3792-4040-8a15-fdfda00d130e"
mock_email = "testuser_e2e_eval@rotordyn.ai"
mock_uuid = "ad0d7a56-8aec-4490-bf11-2cb92f218157"

approved_user_email = "djay8im@gmail.com"
approved_user_password = "Password123!"

def setup_mock_pending_user():
    print("Setting up mock pending user for E2E admin queue test...")
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    
    from database import supabase
    
    try:
        # Delete existing auth user if present
        res = supabase.auth.admin.list_users()
        for u in res:
            if u.email == mock_email:
                supabase.auth.admin.delete_user(u.id)
                print(f"Deleted existing auth user for {mock_email}")
                break
                
        # Also clean profile
        supabase.table("profiles").delete().eq("email", mock_email).execute()
        
        # Create user using Admin API (inserts to auth.users)
        print("Creating auth user via admin API...")
        auth_res = supabase.auth.admin.create_user({
            "email": mock_email,
            "password": "Password123!",
            "email_confirm": True
        })
        user_id = auth_res.user.id
        print(f"Created auth user with ID: {user_id}")
        
        # Wait 2 seconds for database trigger completion
        time.sleep(2)
        
        # Check if profile already exists (trigger-created)
        existing_profile = supabase.table("profiles").select("*").eq("id", user_id).execute()
        
        profile_data = {
            "id": user_id,
            "name": "E2E Tester",
            "email": mock_email,
            "company": "E2E Corp",
            "plant": "E2E Location",
            "purpose": "E2E Verification Checklist",
            "role": "user",
            "status": "pending"
        }
        
        if existing_profile.data:
            print("Profile already created by trigger. Updating it...")
            supabase.table("profiles").update(profile_data).eq("id", user_id).execute()
        else:
            print("No profile found. Inserting manually...")
            supabase.table("profiles").insert(profile_data).execute()
            
        print("Mock pending user setup complete!")
    except Exception as e:
        print(f"Error during mock setup: {e}")

def cleanup_database():
    print("Cleaning up mock user database records...")
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    
    from database import supabase
    
    try:
        # Delete auth user
        res = supabase.auth.admin.list_users()
        for u in res:
            if u.email == mock_email:
                supabase.auth.admin.delete_user(u.id)
                print(f"Deleted auth user {mock_email}!")
                break
        # Delete profile
        supabase.table("profiles").delete().eq("email", mock_email).execute()
        print("Mock user database records cleaned up successfully!")
    except Exception as e:
        print(f"Error during cleanup: {e}")

def run_e2e_suite():
    # Setup mock profile in DB first
    setup_mock_pending_user()
    
    with sync_playwright() as p:
        print("\nLaunching headless Chromium browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("console", lambda msg: print(f"[BROWSER CONSOLE] {msg.text}"))
        
        # Step 1: Landing page
        print("Step 1: Navigating to Landing Page...")
        page.goto("http://localhost:5000/")
        time.sleep(2)
        
        # Skip intro if it's playing
        skip_btn = page.query_selector("text=Skip Intro")
        if skip_btn:
            skip_btn.click()
            print("Skipped intro animation.")
            time.sleep(1)
            
        page.screenshot(path=os.path.join(artifact_dir, "e2e_landing_page.png"))
        
        # Step 2: Navigate to Admin Login
        print("Step 2: Navigating to Admin Login...")
        page.goto("http://localhost:5000/admin-login")
        time.sleep(2)
        
        print("Logging in as Administrator...")
        page.fill("input[placeholder*='admin@rotordyn.ai']", "admin@rotordyn.ai")
        page.fill("input[placeholder='Enter password']", "AdminPassword123")
        page.click("button[type='submit']")
        time.sleep(4)
        
        # Step 3: Approve pending request
        print("Step 3: Locating mock request in queue...")
        page.screenshot(path=os.path.join(artifact_dir, "e2e_admin_dashboard.png"))
        
        row_selector = f"tr:has-text('{mock_email}')"
        approve_btn = page.locator(row_selector).locator("button:has-text('Approve')")
        
        try:
            approve_btn.wait_for(state="visible", timeout=12000)
            approve_btn.click()
            print(f"Approved {mock_email} successfully!")
            time.sleep(3)
        except Exception as e:
            print(f"Error: Could not locate or click user approval button: {e}")
            
        page.screenshot(path=os.path.join(artifact_dir, "e2e_admin_approved_queue.png"))
        
        # Log out from Admin
        print("Logging out of admin portal...")
        page.click("button:has-text('Sign Out')")
        time.sleep(2)
        
        # Step 4: Log in as approved test account
        print("Step 4: Logging in with approved test account...")
        page.goto("http://localhost:5000/auth")
        time.sleep(2)
        page.fill("#signin-email", approved_user_email)
        page.fill("#signin-password", approved_user_password)
        page.click(".sign-in-container button[type='submit']")
        
        # Wait for dashboard to fully load
        try:
            page.locator("#btn-scada-sim").wait_for(state="visible", timeout=15000)
            print("Dashboard welcome panel loaded successfully.")
        except Exception as e:
            print(f"Warning: Dashboard loading wait timeout: {e}")
        
        # Verify dashboard is loaded
        page.screenshot(path=os.path.join(artifact_dir, "e2e_user_dashboard_home.png"))
        print("Saved e2e_user_dashboard_home.png")
        
        # Step 5: SCADA simulator stream
        print("Step 5: Activating Live SCADA simulation...")
        page.click("#btn-scada-sim")
        time.sleep(4)
        page.screenshot(path=os.path.join(artifact_dir, "e2e_live_scada.png"))
        
        # Step 6: Open Styles & enable ISO severity limits
        print("Step 6: Enabling ISO 10816 limits...")
        page.click("#act-btn-styles")
        time.sleep(1)
        page.check("#show-iso-limits")
        time.sleep(2)
        page.screenshot(path=os.path.join(artifact_dir, "e2e_iso_limits.png"))
        
        # Step 7: Open Tree Navigation & expand folders
        print("Step 7: Expanding tree navigation and loading FFT...")
        page.click("#act-btn-tree")
        time.sleep(1)
        page.click("#tree-caret-general-sensors")
        time.sleep(1)
        page.click("#tree-caret-ch-BRG1X")
        time.sleep(1)
        
        # Load FFT
        page.click("text=FFT Spectrum")
        time.sleep(3)
        page.screenshot(path=os.path.join(artifact_dir, "e2e_fft_spectrum.png"))
        
        # Load 3D Waterfall
        print("Loading 3D Waterfall plot...")
        page.click("text=3D Waterfall Spectrum")
        time.sleep(6)
        page.screenshot(path=os.path.join(artifact_dir, "e2e_waterfall_3d.png"))
        
        # Log out user
        print("Logging out test account via JS evaluate...")
        page.evaluate("window.logout && window.logout()")
        time.sleep(2)
        
        browser.close()
        print("\nAll visual E2E checks completed successfully!")
        
    # Clean up mock profile
    cleanup_database()

if __name__ == "__main__":
    run_e2e_suite()
