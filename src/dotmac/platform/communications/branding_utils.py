"""
Branding utilities shared across communications modules.
"""

from __future__ import annotations

from datetime import UTC, datetime

from dotmac.platform.settings import settings
from dotmac.platform.tenant.schemas import TenantBrandingConfig


def derive_brand_tokens(
    branding: TenantBrandingConfig,
) -> tuple[str, str, str]:
    """
    Return (product_name, company_name, support_email) using tenant overrides with global fallbacks.
    """
    product_name = branding.product_name or settings.brand.product_name or "DotMac Platform"
    company_name = branding.company_name or product_name
    support_email = (
        branding.support_email
        or settings.brand.support_email
        or settings.brand.operations_email
        or "support@example.com"
    )
    return product_name, company_name, support_email


def render_branded_email_html(branding: TenantBrandingConfig, content_html: str) -> str:
    """
    Wrap raw HTML content with branded header/footer for consistent styling.
    """
    product_name, company_name, support_email = derive_brand_tokens(branding)
    logo_html = (
        f'<img src="{branding.logo_light_url}" alt="{product_name} logo" '
        f'style="max-height:48px;margin-bottom:12px;" />'
        if branding.logo_light_url
        else f'<h1 style="margin:0 0 12px;font-weight:600;color:#111;">{product_name}</h1>'
    )
    footer = (
        f'<p style="font-size:12px;color:#64748b;margin-top:24px;">'
        f'Need help? Contact <a href="mailto:{support_email}">{support_email}</a>.<br>'
        f"&copy; {datetime.now(UTC).year} {company_name}. All rights reserved."
        f"</p>"
    )
    return (
        '<div style="font-family:Arial,sans-serif;background-color:#f8fafc;'
        'padding:24px;color:#0f172a;">'
        f'<div style="text-align:center;">{logo_html}</div>'
        f'<div style="background:#fff;border-radius:12px;padding:24px;line-height:1.6;">'
        f"{content_html}</div>"
        f'<div style="text-align:center;">{footer}</div>'
        "</div>"
    )


def render_branded_sms_text(message: str, branding: TenantBrandingConfig) -> str:
    """Append product/support signature to SMS content."""
    product_name, _, support_email = derive_brand_tokens(branding)
    signature_parts = [product_name]
    if support_email:
        signature_parts.append(support_email)
    signature = " • ".join(part for part in signature_parts if part)
    body = message.strip()
    if signature:
        return f"{body} [{signature}]"
    return body
