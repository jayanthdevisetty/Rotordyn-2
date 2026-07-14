# Rotordyn.ai: User Manual

**Document Reference**: ROTORDYN-UM-1.0.0  
**Version**: 1.0.0-Beta  
**Date**: July 14, 2026  
**Author**: Customer Success Group  
**Classification**: Public Release  

---

## Document Control

### Revision History

| Version | Date | Author | Description |
| :--- | :--- | :--- | :--- |
| `0.9.0` | 2026-07-06 | Support Lead | Initial interface navigation and walkthroughs. |
| `1.0.0` | 2026-07-14 | Solutions Architect | Added WebGL orbit zooming guides and subscription checkout steps. |

---

## 1. Getting Started

Rotordyn.ai is a cloud diagnostics tool.
1. Navigate to the login page: `https://rotordyn-2.vercel.app/auth`.
2. Enter your email and password, or click Google/GitHub Sign In to authenticate.
3. Upon approval, you will land on the **Upload Dataset** page.

---

## 2. Ingesting Telemetry Datasets

To analyze vibration telemetry data:
1. Locate your vibration telemetry CSV file.
2. Drag and drop the CSV directly into the upload area (`#welcome-screen`).
3. The parser processes columns (e.g. `Timestamp`, `Speed(P)`, and bearing channel sensors like `BRG1X`, `BRG1Y`).
4. Once parsed successfully, the application redirects you to `/dashboard` to view the interactive plots.

---

## 3. Dynamic Charts & Diagnostics

On the plots dashboard:

### 3.1 Time Trend Plots
Displays sensor amplitude/phase trends over the telemetry window. 

### 3.2 Orbit Trajectory plots
Plots dynamic displacement values from dual proximity probes ($X$ and $Y$, angled $90^\circ$ apart) to visualize shaft centerline orbit tracks.
- Use the **Auto-scale** button to bound values based on active viewport coordinates.
- Click and drag inside orbit plots to zoom into specific dynamic cycles.

### 3.3 Speed Profile scrubbing
Use the bottom **Timeline speed timeline** slider to scrub through specific machine startup/shutdown zones. All dynamic plots update instantly to match the selected temporal coordinates.

---

## 4. Troubleshooting & FAQ

### Blank / White Screen on Upload
- **Issue**: Attempting to upload a CSV file results in a white screen or redirects back to `/upload` instantly.
- **Cause**: Browser database version mismatch.
- **Resolution**: Force reload the browser cache (`Ctrl + F5`) to upgrade the local cache database to Version `2` (`RotordynCacheDB`), which recreates the missing database tables.

### "No Data Available" Alerts
- **Issue**: Plot slots display "No Data Available: The active filters returned 0 rows."
- **Cause**: Active RPM filters or State filters exclude all telemetry data.
- **Resolution**: Expand the **Filters** tab on the left control sidebar, adjust minimum/maximum RPM fields, and check that state filters are set to `All`.
