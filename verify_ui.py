import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    print("Starting Playwright check...")
    async with async_playwright() as p:
        # Launch Chromium headless
        browser = await p.chromium.launch(headless=True)
        
        # Open page
        page = await browser.new_page()
        print("Navigating to local site...")
        try:
            await page.goto("http://172.27.96.1:5000/")
        except Exception as e:
            print(f"Failed to connect to dev server: {e}")
            await browser.close()
            return
        
        # Wait for lazy loaded elements to mount
        print("Waiting for page content...")
        await page.wait_for_selector("text=Launch Workspace")
        print(f"Page Title: {await page.title()}")
        
        # Take landing page screenshot
        screenshot_dir = "/mnt/c/Users/shaik/.gemini/antigravity/brain/9b21ea1a-8a6a-45ed-84ae-d8df784b2cd2"
        os.makedirs(screenshot_dir, exist_ok=True)
        
        landing_screenshot_path = os.path.join(screenshot_dir, "landing_validation.png")
        await page.screenshot(path=landing_screenshot_path)
        print(f"Saved landing page screenshot to {landing_screenshot_path}")
        
        # Click Sign In link
        print("Clicking Sign In link...")
        await page.click("text=Sign In")
        await page.wait_for_url("**/auth")
        print(f"URL after click: {page.url}")
        
        auth_screenshot_path = os.path.join(screenshot_dir, "auth_validation.png")
        await page.screenshot(path=auth_screenshot_path)
        print(f"Saved auth page screenshot to {auth_screenshot_path}")
        
        # Verify ProtectedRoute: navigate directly to /upload
        print("Navigating directly to /upload while unauthenticated...")
        await page.goto("http://172.27.96.1:5000/upload")
        await page.wait_for_url("**/auth")
        print(f"URL after accessing guarded /upload: {page.url} (Successfully redirected to auth!)")
        
        # Verify redirect target was stored in localStorage
        target = await page.evaluate("localStorage.getItem('auth_redirect_target')")
        print(f"Stored redirect target in localStorage: {target}")
        assert target == "/upload", f"Expected /upload, got {target}"
        
        # Verify ProtectedRoute: navigate directly to /dashboard
        print("Navigating directly to /dashboard while unauthenticated...")
        await page.goto("http://172.27.96.1:5000/dashboard")
        await page.wait_for_url("**/auth")
        print(f"URL after accessing guarded /dashboard: {page.url} (Successfully redirected to auth!)")
        
        target = await page.evaluate("localStorage.getItem('auth_redirect_target')")
        print(f"Stored redirect target in localStorage: {target}")
        assert target == "/dashboard", f"Expected /dashboard, got {target}"
        
        await browser.close()
        print("Playwright check finished successfully!")

if __name__ == "__main__":
    asyncio.run(run())
