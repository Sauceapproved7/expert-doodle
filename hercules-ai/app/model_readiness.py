"""Public, sanitized evidence for an explicitly configured Hercules model inventory.

This evaluator inspects only the result of a bounded GET /api/tags. It does
not assert successful chat inference, authorize public launch or expose hosts.
"""


def evaluate_model_inventory(inventory, default_model):
    result = {
        "schema": "hercules.model-backend-readiness.v1",
        "model_inventory_ready": False,
        "chat_inference_verified": False,
        "public_release_approved": False,
        "reason": "invalid_model_inventory",
    }
    if not isinstance(default_model, str) or not default_model or default_model != default_model.strip():
        result["reason"] = "invalid_default_model"
        return result
    if not isinstance(inventory, dict):
        return result
    models = inventory.get("models")
    if not isinstance(models, list) or any(
        not isinstance(model, dict)
        or not isinstance(model.get("name"), str)
        or not model["name"].strip()
        for model in models
    ):
        return result
    if not any(model["name"] == default_model for model in models):
        result["reason"] = "default_model_missing"
        return result
    result["model_inventory_ready"] = True
    result["reason"] = "default_model_found"
    return result
