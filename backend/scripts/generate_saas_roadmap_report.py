import os

output_file_workspace = r"e:\rotordyn-ai-v2\rotordyn_saas_features_and_roadmap.html"
output_file_downloads = r"C:\Users\shaik\Downloads\rotordyn_saas_features_and_roadmap.html"

def build_html():
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rotordyn.ai - Features Catalogue & SaaS Commercialization Roadmap</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f172a;
            --card-color: #1e293b;
            --text-color: #f8fafc;
            --text-muted: #94a3b8;
            --accent-color: #3b82f6;
            --border-color: #334155;
            --success-color: #10b981;
            --warning-color: #f59e0b;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            line-height: 1.6;
            padding: 40px 20px;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        
        header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 30px;
        }
        
        .logo {
            font-family: 'Outfit', sans-serif;
            font-size: 2.2rem;
            font-weight: 800;
            letter-spacing: 1px;
            background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }
        
        header h1 {
            font-size: 1.8rem;
            font-weight: 800;
            margin-bottom: 10px;
        }
        
        header p {
            color: var(--text-muted);
            font-size: 1rem;
        }
        
        .badge {
            display: inline-block;
            background-color: rgba(59, 130, 246, 0.15);
            border: 1px solid rgba(59, 130, 246, 0.3);
            color: var(--accent-color);
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 0.85rem;
            font-weight: 700;
            margin-top: 15px;
            text-transform: uppercase;
        }
        
        .section-title {
            font-size: 1.4rem;
            font-weight: 700;
            margin: 30px 0 20px;
            color: #60a5fa;
            border-left: 4px solid var(--accent-color);
            padding-left: 12px;
        }
        
        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .card {
            background-color: var(--card-color);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        }
        
        .card h3 {
            font-size: 1.1rem;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .card p {
            color: var(--text-muted);
            font-size: 0.88rem;
        }
        
        .roadmap-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin-bottom: 40px;
        }
        
        .roadmap-item {
            background-color: var(--card-color);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 20px;
            display: flex;
            gap: 20px;
            align-items: flex-start;
        }
        
        .roadmap-step {
            background-color: rgba(245, 158, 11, 0.15);
            border: 1px solid rgba(245, 158, 11, 0.3);
            color: var(--warning-color);
            font-family: 'Outfit', sans-serif;
            font-weight: 800;
            font-size: 1.1rem;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        
        .roadmap-content h4 {
            font-size: 1.1rem;
            margin-bottom: 6px;
        }
        
        .roadmap-content p {
            color: var(--text-muted);
            font-size: 0.9rem;
        }
        
        .footer {
            text-align: center;
            color: var(--text-muted);
            font-size: 0.8rem;
            margin-top: 60px;
            border-top: 1px solid var(--border-color);
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">ROTORDYN.AI</div>
            <h1>Features & SaaS Launch Roadmap</h1>
            <p>A comprehensive review of the active capabilities and path to commercial launch</p>
            <span class="badge">Platform Scope Report</span>
        </header>
        
        <h2 class="section-title">Current Feature Catalogue</h2>
        <div class="feature-grid">
            <div class="card">
                <h3>📊 Multi-Plot Grid Workspace</h3>
                <p>Configurable slot grids (1V, 2V, 2H, 3V, 4-Grid) that scale dynamic Plotly charts matching analysts' layouts.</p>
            </div>
            <div class="card">
                <h3>🔄 Bode, Polar & Orbits</h3>
                <p>Vibration amplitude and phase plotted relative to shaft speeds, dynamic orbits with configurable cycle limits, and probe direction indicators.</p>
            </div>
            <div class="card">
                <h3>📈 Shaft Centerline</h3>
                <p>DC gap voltage offset plotted in bearing clearance circles, with centerline overlays showing dynamic shaft motion boundaries.</p>
            </div>
            <div class="card">
                <h3>📶 FFT & WebGL Waterfall</h3>
                <p>Real-time fast Fourier transform spectral calculation, and 3D WebGL waterfall cascades plotted dynamically.</p>
            </div>
            <div class="card">
                <h3>🔌 WebSocket SCADA Stream</h3>
                <p>Bidirectional live connection to backend (/scada/stream) streaming machine status packets at 10 Hz with sliding time window buffers.</p>
            </div>
            <div class="card">
                <h3>⚙️ Slow Roll & Multi-Spool</h3>
                <p>Zero-speed runout sample vectors subtraction, and custom gear ratio multipliers scaling secondary shaft speed plots.</p>
            </div>
            <div class="card">
                <h3>🤖 Gemini Health Reports</h3>
                <p>Automated technical report drafts streaming via Server-Sent Events utilizing the Gemini AI model.</p>
            </div>
            <div class="card">
                <h3>🔒 Security Admin Queue</h3>
                <p>Social Auth integrations (Google/GitHub), secured SMTP admin notices, and manual account approval queue locks.</p>
            </div>
        </div>
        
        <h2 class="section-title">SaaS Commercialization Roadmap</h2>
        <div class="roadmap-list">
            <div class="roadmap-item">
                <div class="roadmap-step">01</div>
                <div class="roadmap-content">
                    <h4>Billing & Subscription Gateway</h4>
                    <p>Integrate Stripe or Lemon Squeezy to manage checkout, recurring subscription cycles (monthly/annual), and dynamically toggle quotas based on subscription tier.</p>
                </div>
            </div>
            <div class="roadmap-item">
                <div class="roadmap-step">02</div>
                <div class="roadmap-content">
                    <h4>Database Row-Level Security (RLS)</h4>
                    <p>Enforce strict security policies inside Supabase, securing metadata records and uploads so data partitions are strictly isolated per company/user.</p>
                </div>
            </div>
            <div class="roadmap-item">
                <div class="roadmap-step">03</div>
                <div class="roadmap-content">
                    <h4>Private Storage Buckets</h4>
                    <p>Harden Supabase storage bucket permissions. Restrict files from public URLs, forcing downloads to verify auth headers and serve via temporary presigned links.</p>
                </div>
            </div>
            <div class="roadmap-item">
                <div class="roadmap-step">04</div>
                <div class="roadmap-content">
                    <h4>Organizations & Team Management</h4>
                    <p>Allow users to establish shareable company workspaces, enabling colleagues to view collective analysis logs and telemetry files under a unified license tier.</p>
                </div>
            </div>
            <div class="roadmap-item">
                <div class="roadmap-step">05</div>
                <div class="roadmap-content">
                    <h4>Audit Trails & Logging</h4>
                    <p>Integrate application log compliance, storing user login logs, data modifications, and AI generation parameters for security compliance.</p>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>&copy; 2026 Rotordyn.ai Systems. All rights reserved. Self-contained feature and roadmap documentation.</p>
        </div>
    </div>
</body>
</html>
"""
    
    with open(output_file_workspace, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Roadmap HTML generated successfully in workspace: {output_file_workspace}")
    
    try:
        with open(output_file_downloads, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"Roadmap HTML copied to Downloads: {output_file_downloads}")
    except Exception as e:
        print(f"Warning: Could not copy to Downloads: {e}")

if __name__ == "__main__":
    build_html()
