import os
import time
from playwright.sync_api import sync_playwright

artifact_dir = r"C:\Users\shaik\.gemini\antigravity\brain\69e38a35-3792-4040-8a15-fdfda00d130e"

def run_tests():
    with sync_playwright() as p:
        print("Launching Chromium Browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        
        print("Navigating to Rotordyn Vercel App...")
        page.goto("https://rotordyn-2.vercel.app/auth")
        time.sleep(3)
        
        # Capture Auth page screenshot
        page.screenshot(path=os.path.join(artifact_dir, "auth_page.png"))
        print("Saved auth_page.png")
        
        # Login
        print("Logging in with djay8im@gmail.com...")
        page.fill("#signin-email", "djay8im@gmail.com")
        page.fill("#signin-password", "Password123!")
        page.click(".sign-in-container button[type='submit']")
        time.sleep(5)
        
        # Verify if on dashboard or welcome screen
        page.screenshot(path=os.path.join(artifact_dir, "dashboard_home.png"))
        print("Saved dashboard_home.png")
        
        # Click Simulate Live SCADA Feed
        print("Starting Live SCADA Simulation Feed...")
        page.click("#btn-scada-sim")
        time.sleep(4)
        
        # Capture SCADA stream running
        page.screenshot(path=os.path.join(artifact_dir, "live_scada.png"))
        print("Saved live_scada.png")
        
        # Expand sidebar if needed and open Styles tab
        print("Opening Styles & Formatting Tab...")
        toggle_btn = page.query_selector("#sidebar-toggle-btn")
        if toggle_btn and "Expand" in toggle_btn.get_attribute("title"):
            toggle_btn.click()
            time.sleep(1)
            
        page.click("#act-btn-styles")
        time.sleep(1)
            
        print("Enabling ISO 10816 limits...")
        page.check("#show-iso-limits")
        time.sleep(2)
        page.screenshot(path=os.path.join(artifact_dir, "iso_limits.png"))
        print("Saved iso_limits.png")
        
        # Find gear ratio and change it
        print("Changing Gearbox Multiplier to 2.0...")
        page.fill("#gear-ratio-input", "2.00")
        page.press("#gear-ratio-input", "Enter")
        time.sleep(2)
        
        # Drag & Drop Swap Slots
        print("Performing Drag & Drop swapping on slots...")
        slot0_header = page.locator(".grid-card[data-index='0'] .grid-card-header")
        slot1_header = page.locator(".grid-card[data-index='1'] .grid-card-header")
        slot0_header.drag_to(slot1_header)
        time.sleep(3)
        page.screenshot(path=os.path.join(artifact_dir, "drag_and_drop.png"))
        print("Saved drag_and_drop.png")
        
        # Load FFT Spectrum
        print("Opening Sensor Navigation Tab...")
        page.click("#act-btn-tree")
        time.sleep(1)
        
        print("Expanding General Sensors tree node...")
        page.click("#tree-caret-general-sensors")
        time.sleep(1)
        
        print("Expanding BRG1X tree node...")
        page.click("#tree-caret-ch-BRG1X")
        time.sleep(1)
        
        print("Loading FFT Spectrum plot...")
        page.click("text=FFT Spectrum")
        time.sleep(3)
        page.screenshot(path=os.path.join(artifact_dir, "fft_spectrum.png"))
        print("Saved fft_spectrum.png")
        
        # Load 3D Waterfall Spectrum
        print("Loading 3D Waterfall Spectrum plot...")
        page.click("text=3D Waterfall Spectrum")
        time.sleep(6)
        page.screenshot(path=os.path.join(artifact_dir, "waterfall_3d.png"))
        print("Saved waterfall_3d.png")
        
        browser.close()
        print("Verification script finished successfully!")

if __name__ == "__main__":
    run_tests()
