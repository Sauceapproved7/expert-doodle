from app.speed import speed_profile

def test_speed_profiles_scale_latency_and_depth():
    turbo=speed_profile("turbo")
    balanced=speed_profile("balanced")
    deep=speed_profile("deep")
    assert turbo["latency_bias"] < balanced["latency_bias"] < deep["latency_bias"]
    assert turbo["max_tokens"] < balanced["max_tokens"] < deep["max_tokens"]
    assert turbo["reasoning_depth"] < balanced["reasoning_depth"] < deep["reasoning_depth"]

def test_speed_profile_defaults_to_balanced():
    assert speed_profile(None)["mode"]=="balanced"

def test_speed_profile_rejects_unknown_mode():
    try:
        speed_profile("warp")
    except ValueError as e:
        assert "Unknown speed mode" in str(e)
    else:
        raise AssertionError("unknown speed mode should fail")
