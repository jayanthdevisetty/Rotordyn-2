import httpx
import sys

def verify_live_deployment(url: str):
    print("="*80)
    print(f"VERIFYING LIVE DEPLOYMENT URL: {url}")
    print("="*80)
    
    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.get(url)
            
        print(f"HTTP Status Code: {res.status_code}")
        print(f"Response Latency: {res.elapsed.total_seconds() * 1000:.2f} ms")
        print("\nChecking Security Headers:")
        print("-" * 30)
        
        headers = res.headers
        checks = {
            "Strict-Transport-Security": "HSTS",
            "Content-Security-Policy": "CSP",
            "X-Frame-Options": "Clickjacking Protection",
            "X-Content-Type-Options": "Sniffing Protection",
            "X-XSS-Protection": "XSS Filter"
        }
        
        passed = True
        for header, description in checks.items():
            value = headers.get(header)
            if value:
                print(f"[OK] {header}: {value[:50]}...")
            else:
                print(f"[MISSING] {header} is MISSING ({description})")
                passed = False
                
        print("-" * 30)
        if passed:
            print("ALL SECURITY HEADERS ARE ACTIVE!")
        else:
            print("SOME SECURITY HEADERS ARE MISSING.")
            
    except Exception as e:
        print(f"FAIL: Could not query live URL: {e}")

if __name__ == "__main__":
    target = "https://rotordyn-2.vercel.app"
    if len(sys.argv) > 1:
        target = sys.argv[1]
    verify_live_deployment(target)
