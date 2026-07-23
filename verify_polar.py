import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    print("Starting Playwright Polar Plot Verification...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page()
        
        # Log console messages and errors
        page.on("console", lambda msg: print(f"[Browser Console] {msg.text}"))
        page.on("pageerror", lambda err: print(f"[Browser PageError] {err}"))
        
        # 1. Navigate to front-end page
        target_url = "http://172.27.96.1:5000/"
        print(f"Navigating to {target_url} ...")
        try:
            await page.goto(target_url)
        except Exception as e:
            print(f"Failed to connect to dev server: {e}")
            await browser.close()
            return
            
        # Clear storage and database
        print("Clearing local storage cache...")
        await page.evaluate("""() => {
            localStorage.clear();
            sessionStorage.clear();
            indexedDB.deleteDatabase("RotordynCacheDB");
        }""")
        
        await page.goto(target_url)
        
        # 2. Click Sign In
        print("Clicking Sign In...")
        await page.click("text=Sign In")
        
        print("Waiting for sign-in inputs...")
        await page.wait_for_selector("#signin-email", timeout=10000)
        
        # Fill credentials
        print("Filling credentials...")
        await page.fill("#signin-email", "djay8im@gmail.com")
        await page.fill("#signin-password", "djay8im")
        await page.press("#signin-password", "Enter")
        
        print("Waiting for redirection to workspace...")
        await asyncio.sleep(8)
        
        # Navigate to /dashboard
        print("Navigating to dashboard...")
        await page.goto("http://172.27.96.1:5000/dashboard")
        await asyncio.sleep(8)
        
        # 3. Populate Slot with Polar Plot via toolbar method
        print("Invoking toolbar action to populate slot with Polar Plot...")
        await page.evaluate("window.populatePlotFromToolbar('polar')")
        
        # 4. Wait for Plotly render
        print("Waiting for polar plots to load...")
        await asyncio.sleep(12)
        
        # 5. Check SVG and Polar Background DOM elements
        print("Locating polar plot elements...")
        polar_present = await page.locator(".polar").count()
        print(f"Number of polar plots found in DOM: {polar_present}")
        
        # Let's inspect class names under .polar
        classes = await page.evaluate("""() => {
            const els = Array.from(document.querySelectorAll('.polar *'));
            return els.map(el => ({ tag: el.tagName, className: el.className.baseVal || el.className }));
        }""")
        print("Classes under .polar:")
        for c in classes[:40]:
            print(f"  {c['tag']}: {c['className']}")
            
        bg_selector = ".polar .bg, .polar path.bg"
        bg_present = await page.locator(bg_selector).count()
        print(f"Number of polar background circles found in DOM: {bg_present}")
        
        if bg_present > 0:
            bg_rect = await page.locator(bg_selector).first.bounding_box()
            print(f"Bounding box of first polar background circle: {bg_rect}")
            
        # 6. Check the newly added 'Auto-Color States' button on the speed profile timeline
        print("Checking for the 'Auto-Color States' button in the timeline bar...")
        timeline_btn_selector = "#btn-auto-color-change-timeline"
        timeline_btn_count = await page.locator(timeline_btn_selector).count()
        print(f"Timeline Auto-Color button count: {timeline_btn_count}")
        
        if timeline_btn_count > 0:
            btn_active_initial = await page.locator(timeline_btn_selector).evaluate("el => el.classList.contains('active')")
            print(f"Initial active state of timeline auto-color button: {btn_active_initial}")
            
            # Click button to toggle state coloring
            print("Clicking timeline 'Auto-Color States' button...")
            await page.click(timeline_btn_selector)
            await asyncio.sleep(2)
            
            btn_active_after = await page.locator(timeline_btn_selector).evaluate("el => el.classList.contains('active')")
            print(f"Active state after first click: {btn_active_after}")
            
            # Click it again
            print("Clicking timeline button again...")
            await page.click(timeline_btn_selector)
            await asyncio.sleep(2)
            
            btn_active_final = await page.locator(timeline_btn_selector).evaluate("el => el.classList.contains('active')")
            print(f"Active state after second click: {btn_active_final}")
            
        # 7. Start Playback to verify playhead scrubbing and arrowhead updates
        print("Starting playback to test playhead updates...")
        play_btn_selector = "#tl-btn-play"
        await page.click(play_btn_selector)
        print("Playback running... waiting 6 seconds...")
        await asyncio.sleep(6)
        
        # Stop Playback
        print("Stopping playback...")
        await page.click(play_btn_selector)
        
        # Save validation screenshot
        screenshot_dir = "/mnt/c/Users/shaik/.gemini/antigravity/brain/9b21ea1a-8a6a-45ed-84ae-d8df784b2cd2"
        os.makedirs(screenshot_dir, exist_ok=True)
        screenshot_path = os.path.join(screenshot_dir, "polar_validation.png")
        await page.screenshot(path=screenshot_path)
        print(f"Saved validation screenshot to: {screenshot_path}")
        
        await browser.close()
        print("Playwright Polar Plot Verification successfully completed!")

if __name__ == "__main__":
    asyncio.run(run())
