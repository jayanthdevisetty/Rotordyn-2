import os
import httpx
import json

def test_gemini_integration():
    print("Testing Google Gemini API integration...")
    
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    
    from config import settings
    
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        print("Error: GEMINI_API_KEY is not set in backend/.env!")
        return False
        
    print(f"Using Gemini API Key: {api_key[:10]}...{api_key[-5:]}")
    
    # Set up request payload mimicking frontend report generator
    payload = {
        "bearing_name": "BRG1X/BRG1Y Probes",
        "primary_diagnosis": "Severe Unbalance (1X Dominated Response)",
        "confidence_score": 92,
        "recommendations": "Perform dynamic single-plane field balancing on the coupling-side rotor disk. Inspect bearing support structures for loose foundation bolts.",
        "critical_speeds": {
            "critical_1": "1650 RPM",
            "critical_2": "3450 RPM",
            "current_speed": "3612 RPM (Steady State)"
        },
        "telemetry_summary": {
            "vibration_amplitude_mils_pp": 2.45,
            "phase_angle_deg": 306.0,
            "average_gap_voltage_v": -8.27
        }
    }
    
    # Build prompt same as reports.py
    prompt = f"""
    You are an expert rotating machinery engineer and senior vibration analyst.
    Please generate a professional turbomachinery engineering maintenance report based on the following diagnostic metadata:

    - Probe Location: {payload['bearing_name']}
    - Primary Diagnosed Issue: {payload['primary_diagnosis']}
    - Diagnostic Confidence Score: {payload['confidence_score']}%
    - Standard Heuristic Recommendations: {payload['recommendations']}
    
    Identified Critical Speeds (Resonance):
    {payload['critical_speeds']}

    Telemetry and Operation Bounds:
    {payload['telemetry_summary']}

    Please write a brief Machinery Health Report. Make sure it contains:
    1. EXECUTIVE SUMMARY
    2. FAULT MECHANISMS (Brief explanation)
    3. ACTIONS REQUIRED

    Format the report in clean Markdown.
    """
    
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    data = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ]
    }
    
    try:
        print("Sending POST request to Google Gemini API (gemini-2.5-flash)...")
        response = httpx.post(url, headers=headers, json=data, timeout=20.0)
        
        if response.status_code == 200:
            print("Successfully received 200 response from Gemini API!")
            res_data = response.json()
            candidates = res_data.get("candidates", [])
            if candidates:
                text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                print("\n=== AI GENERATED MACHINERY REPORT PREVIEW ===")
                print(text[:450] + "\n...")
                print("=============================================\n")
                print("Google Gemini AI health report generation is FULLY FUNCTIONAL! ✅")
                return True
            else:
                print(f"Error: Response candidates were empty: {res_data}")
                return False
        else:
            print(f"API Error (status code {response.status_code}): {response.text}")
            return False
            
    except Exception as e:
        print(f"Connection Exception: {e}")
        return False

if __name__ == "__main__":
    test_gemini_integration()
