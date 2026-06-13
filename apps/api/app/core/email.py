from email.message import EmailMessage
import smtplib

from app.core.config import Settings


def build_password_reset_url(settings: Settings, token: str) -> str:
    return f"{settings.frontend_base_url.rstrip('/')}/reset-password?token={token}"


def send_password_reset_email(settings: Settings, recipient: str, reset_url: str) -> None:
    if not settings.password_reset_email_enabled:
        return
    message = EmailMessage()
    message["Subject"] = "Reset your Apply Wise password"
    message["From"] = settings.smtp_from_email
    message["To"] = recipient
    message.set_content(
        "\n".join(
            [
                "You requested a password reset for Apply Wise.",
                "",
                f"Open this secure link to reset your password: {reset_url}",
                "",
                "If you did not request this, you can ignore this email.",
                f"For help, contact {settings.support_email}.",
            ]
        )
    )
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
