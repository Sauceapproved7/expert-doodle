"""Read-only Floodgates runtime status. Never grants production authorization."""
from fastapi import APIRouter

router = APIRouter()
CHECKS = (
    "spaceship_authorized", "dns_verified", "shopify_domain_ssl_verified",
    "inventory_verified", "payment_provider_live_verified",
    "payout_destination_verified", "paid_checkout_verified",
    "refund_verified", "owner_launch_approval",
)

@router.get("/floodgates/status")
def floodgates_status():
    # This public informational endpoint deliberately accepts no user-supplied
    # evidence and cannot assert provider verification or launch approval.
    return {
        "system": "Hercules Floodgates",
        "mode": "read-only-preflight",
        "domain": "sauceapproved.com",
        "checks": [{"key": key, "passed": False} for key in CHECKS],
        "missing": list(CHECKS),
        "policyReady": False,
        "ready": False,
        "productionAuthorized": False,
        "notice": "Provider evidence and owner approval require independent privileged verification.",
    }
