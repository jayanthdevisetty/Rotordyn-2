import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import os
import asyncio
import httpx
from config import settings

def send_upload_email_sync(
    user_name: str,
    user_email: str,
    company: str,
    timestamp: str,
    filename: str,
    file_size_bytes: int,
    file_path: str
):
    """Synchronous function to connect to Gmail SMTP and send the email with attachment/URL link."""
    # Check if credentials are set
    if not settings.GMAIL_USERNAME or not settings.GMAIL_APP_PASSWORD:
        print("WARNING: SMTP credentials not set (GMAIL_USERNAME / GMAIL_APP_PASSWORD). Email notification skipped.")
        return
        
    msg = MIMEMultipart()
    msg['From'] = settings.GMAIL_USERNAME
    msg['To'] = settings.ADMIN_UPLOAD_EMAIL
    msg['Subject'] = f"New Rotordyn Upload - {filename}"
    
    # Format file size for readability
    size_str = f"{file_size_bytes / 1024:.1f} KB" if file_size_bytes < 1024 * 1024 else f"{file_size_bytes / (1024 * 1024):.2f} MB"
    
    body = f"""A user has uploaded a new vibration data file to Rotordyn.ai.

User Profile:
--------------------------------------------
Name: {user_name}
Email: {user_email}
Company: {company}

Upload Details:
--------------------------------------------
File Name: {filename}
File Size: {size_str}
Timestamp: {timestamp}

"""
    if file_path.startswith("http"):
        body += f"Download File URL: {file_path}\n\nThe uploaded file is attached to this email (downloaded from Supabase Storage)."
    else:
        body += "The uploaded file is attached to this email."
        
    msg.attach(MIMEText(body, 'plain'))
    
    # Fetch file data
    file_data = None
    if file_path.startswith("http"):
        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.get(file_path)
                if res.status_code == 200:
                    file_data = res.content
        except Exception as e:
            print(f"ERROR: Failed to download file from Supabase URL: {e}")
    elif os.path.exists(file_path):
        try:
            with open(file_path, 'rb') as f:
                file_data = f.read()
        except Exception as e:
            print(f"ERROR: Failed to read local file: {e}")
            
    # Attach the file if fetched successfully
    if file_data:
        try:
            payload = MIMEBase('application', 'octet-stream')
            payload.set_payload(file_data)
            encoders.encode_base64(payload)
            payload.add_header('Content-Disposition', f'attachment; filename="{filename}"')
            msg.attach(payload)
        except Exception as e:
            print(f"ERROR: Failed to encode and attach file data: {e}")
            
    # Send the email via Gmail SMTP server
    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(settings.GMAIL_USERNAME, settings.GMAIL_APP_PASSWORD)
            server.send_message(msg)
            print(f"INFO: Upload notification email sent to {settings.ADMIN_UPLOAD_EMAIL} successfully.")
    except Exception as e:
        print(f"ERROR: Failed to send email via SMTP: {e}")

async def send_upload_email(
    user_name: str,
    user_email: str,
    company: str,
    timestamp: str,
    filename: str,
    file_size_bytes: int,
    file_path: str
):
    """Asynchronous wrapper that runs the blocking smtplib email send in a separate thread pool."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        send_upload_email_sync,
        user_name,
        user_email,
        company,
        timestamp,
        filename,
        file_size_bytes,
        file_path
    )
