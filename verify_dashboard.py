import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    print("Starting Playwright check on port 8000...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Log console messages
        page.on("console", lambda msg: print(f"[Browser Console] {msg.text}"))
        page.on("pageerror", lambda err: print(f"[Browser PageError] {err}"))
        
        # Navigate to 127.0.0.1 to match CSP 'self'
        print("Navigating to 127.0.0.1 root page...")
        try:
            await page.goto("http://127.0.0.1:8000/")
        except Exception as e:
            print(f"Failed to connect to dev server: {e}")
            await browser.close()
            return
            
        # Clear Cache
        print("Clearing client-side cache database...")
        await page.evaluate("""() => {
            localStorage.clear();
            sessionStorage.clear();
            indexedDB.deleteDatabase("RotordynCacheDB");
        }""")
        
        # Reload to apply cleared cache
        await page.goto("http://127.0.0.1:8000/")
        
        print("Clicking Sign In...")
        await page.click("text=Sign In")
        
        print("Waiting for redirection/inputs...")
        try:
            await page.wait_for_selector("#signin-email", timeout=10000)
            print("Successfully loaded sign-in page!")
        except Exception as e:
            print(f"Failed to load sign-in inputs: {e}")
            await page.screenshot(path="failed_load.png")
            await browser.close()
            return
            
        # Fill credentials
        print("Filling credentials...")
        await page.fill("#signin-email", "djay8im@gmail.com")
        await page.fill("#signin-password", "djay8im")
        
        # Press Enter to submit the form
        print("Pressing Enter to submit form...")
        await page.press("#signin-password", "Enter")
        
        print("Waiting for page load and redirection...")
        await asyncio.sleep(8)
        print(f"Current URL: {page.url}")
        
        # Navigate to dashboard
        print("Navigating to dashboard...")
        await page.goto("http://127.0.0.1:8000/dashboard")
        
        print("Waiting for modal to load...")
        await asyncio.sleep(8)
        
        # Click the "Rotor Orbit Plots" option in the modal
        print("Selecting 'Rotor Orbit Plots' in modal...")
        await page.click("text=Rotor Orbit Plots")
        
        # Click confirm button
        print("Confirming selection...")
        await page.click("text=Render Selected Layout")
        
        # Wait 15 seconds for Plotly render
        print("Waiting for Plotly orbits to render...")
        await asyncio.sleep(15)
        
        # Check the 'Trace 2' checkbox for slot 0 to show both stacked waveforms
        print("Checking 'Trace 2' checkbox for slot 0...")
        try:
            # Click the checkbox
            await page.click("input[onchange^='toggleOrbitTrace2(0']")
            print("Checkbox clicked successfully!")
            # Wait for layout updates
            await asyncio.sleep(5)
        except Exception as e:
            print(f"Failed to click checkbox: {e}")
            
        print(f"Current URL: {page.url}")
        
        # Save screenshot
        screenshot_dir = r"C:\Users\shaik\.gemini\antigravity\brain\9b21ea1a-8a6a-45ed-84ae-d8df784b2cd2"
        os.makedirs(screenshot_dir, exist_ok=True)
        screenshot_path = os.path.join(screenshot_dir, "dashboard_orbit.png")
        
        await page.screenshot(path=screenshot_path)
        print(f"Saved dashboard screenshot to {screenshot_path}")
        
        await browser.close()
        print("Finished!")

if __name__ == "__main__":
    asyncio.run(run())
