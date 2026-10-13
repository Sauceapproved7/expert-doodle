"""Pure, read-only comparison of public DNS and TLS evidence.

Does not contact registrar, mutate DNS, or infer provider authorization.
"""
from datetime import datetime, timezone
from ipaddress import ip_address

EXPECTED = {
    "A": ["23.227.38.65"],
    "AAAA": ["2620:127:f00f:5::"],
    "www_CNAME": ["shops.myshopify.com"],
}


def _canonical(record_type, values):
    if record_type in ("A", "AAAA"):
        return sorted({str(ip_address(value.strip())) for value in values})
    return sorted({value.strip().rstrip(".").lower() for value in values})


def compare_shopify_dns(observed):
    """Compare observed public records against expected Shopify routing."""
    mismatches = []
    normalized = {}
    for record_type, expected in EXPECTED.items():
        actual = _canonical(record_type, observed.get(record_type, []))
        target = _canonical(record_type, expected)
        normalized[record_type] = actual
        if actual != target:
            mismatches.append({"type": record_type, "expected": target, "observed": actual})
    return {
        "matches": not mismatches,
        "observed": normalized,
        "mismatches": mismatches,
        "scope": "public_dns_only",
        "registrar_authorization_verified": False,
        "shopify_primary_host_verified": False,
    }


def summarize_tls(cert, now=None):
    """Summarize certificate expiry without asserting registrar access."""
    instant = datetime.fromisoformat(now) if now else datetime.now(timezone.utc)
    if instant.tzinfo is None:
        raise ValueError("now must include timezone")
    expiry = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
    return {
        "expires_at": expiry.isoformat(),
        "valid_at_check": expiry > instant,
        "days_remaining": (expiry - instant).days,
        "scope": "tls_certificate_only",
    }
