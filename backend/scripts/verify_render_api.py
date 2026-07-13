import httpx

def verify_backend_api():
    base_url = "https://rotordyn-2.onrender.com"
    print("="*80)
    print(f"VERIFYING LIVE RENDER BACKEND: {base_url}")
    print("="*80)
    
    with httpx.Client(timeout=15.0) as client:
        # 1. Health check
        try:
            print("\n1. Querying /health endpoint:")
            res = client.get(f"{base_url}/health")
            print(f"Status Code: {res.status_code}")
            print(f"Content: {res.json()}")
        except Exception as e:
            print(f"FAILED /health check: {e}")
            
        # 2. Prometheus metrics
        try:
            print("\n2. Querying /metrics endpoint:")
            res = client.get(f"{base_url}/metrics")
            print(f"Status Code: {res.status_code}")
            print(f"Content Snippet:\n{res.text[:300]}")
        except Exception as e:
            print(f"FAILED /metrics check: {e}")
            
        # 3. Test Invalid Login HTTP Response
        try:
            print("\n3. Testing invalid auth/login endpoint:")
            login_data = {"email": "invalid@rotordyn.ai", "password": "wrongpassword"}
            res = client.post(f"{base_url}/auth/login", json=login_data)
            print(f"Status Code: {res.status_code}")
            print(f"Content: {res.json()}")
        except Exception as e:
            print(f"FAILED auth/login check: {e}")

if __name__ == "__main__":
    verify_backend_api()
