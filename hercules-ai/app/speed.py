PROFILES={
 "turbo":{"mode":"turbo","latency_bias":1,"reasoning_depth":1,"max_tokens":512,"timeout_seconds":45,"model_slot":"fast"},
 "fast":{"mode":"fast","latency_bias":2,"reasoning_depth":2,"max_tokens":1024,"timeout_seconds":90,"model_slot":"fast"},
 "balanced":{"mode":"balanced","latency_bias":3,"reasoning_depth":3,"max_tokens":2048,"timeout_seconds":180,"model_slot":"balanced"},
 "deep":{"mode":"deep","latency_bias":4,"reasoning_depth":4,"max_tokens":4096,"timeout_seconds":300,"model_slot":"deep"},
 "max":{"mode":"max","latency_bias":5,"reasoning_depth":5,"max_tokens":8192,"timeout_seconds":600,"model_slot":"deep"},
}
def speed_profile(mode=None):
    key=(mode or "balanced").lower()
    if key not in PROFILES:
        raise ValueError(f"Unknown speed mode: {key}")
    return dict(PROFILES[key])
