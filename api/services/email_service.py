import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def send_magic_link(to_email: str, token: str) -> None:
    """Send a magic-link login email. Raises smtplib.SMTPException on failure."""
    base_url = os.getenv("APP_BASE_URL", "http://localhost:3000")
    link = f"{base_url}/auth/verify?token={token}"

    smtp_host     = os.getenv("SMTP_HOST", "localhost")
    smtp_port     = int(os.getenv("SMTP_PORT", "587"))
    smtp_user     = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_from     = os.getenv("SMTP_FROM", smtp_user)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your DeisBikes login link"
    msg["From"]    = smtp_from
    msg["To"]      = to_email

    text = (
        f"Log in to DeisBikes (valid 15 minutes):\n\n{link}\n\n"
        "Ignore this email if you didn't request it."
    )
    html = (
        f'<p>Click the link below to log in to DeisBikes.'
        f' It expires in <strong>15 minutes</strong>.</p>'
        f'<p><a href="{link}">Log in to DeisBikes</a></p>'
        f'<p>Ignore this email if you didn\'t request it.</p>'
    )
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.ehlo()
        server.starttls()
        if smtp_user and smtp_password:
            server.login(smtp_user, smtp_password)
        server.sendmail(smtp_from, to_email, msg.as_string())
