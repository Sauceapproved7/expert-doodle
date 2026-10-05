from pathlib import Path


def test_mcp_runtime_uses_official_streamable_http_transport():
    requirements = Path("hercules-ai/requirements.txt").read_text()
    source = Path("hercules-ai/app/main.py").read_text()
    runtime = Path("hercules-ai/app/mcp_runtime.py").read_text()

    assert "mcp==2.3.0" in requirements
    assert "MCPServer" in runtime
    assert "streamable_http_app" in source
    assert 'app.mount("/mcp"' in source


def test_legacy_hand_rolled_mcp_route_is_removed():
    source = Path("hercules-ai/app/main.py").read_text()

    assert '@app.post("/mcp")' not in source
    assert "RpcRequest" not in source


def test_transport_security_remains_fail_closed_for_public_hosts():
    runtime = Path("hercules-ai/app/mcp_runtime.py").read_text()

    assert "HERCULES_MCP_ALLOWED_HOSTS" in runtime
    assert "TransportSecuritySettings" in runtime
    assert "enable_dns_rebinding_protection=True" in runtime


def test_public_mcp_tools_declare_explicit_safe_annotations():
    runtime = Path("hercules-ai/app/mcp_runtime.py").read_text()

    assert "ToolAnnotations" in runtime
    assert "read_only_hint=True" in runtime
    assert "destructive_hint=False" in runtime
    assert "open_world_hint=False" in runtime
    assert runtime.count("annotations=READ_ONLY_CLOSED_WORLD") == 5


def test_public_tool_contract_uses_action_oriented_names_and_usage_descriptions():
    runtime = Path("hercules-ai/app/mcp_runtime.py").read_text()

    for name in (
        "hercules.get_status",
        "hercules.plan_mission",
        "hercules.get_vault_summary",
        "hercules.list_models",
        "hercules.verify_vault",
    ):
        assert f'name="{name}"' in runtime

    assert 'name="hercules.command.' not in runtime
    assert runtime.count('description="Use when ') == 5
    assert runtime.count('title="') >= 5
    assert "never changes Hercules state" in runtime
    assert "never deploys or changes state" in runtime
    assert "never returns raw event records" in runtime
    assert "Returns model name and size only" in runtime
    assert "Returns validity and event count only" in runtime


def test_runtime_emits_non_secret_mcp_readiness_evidence():
    source = Path("hercules-ai/app/main.py").read_text()

    assert '"event":"hercules_mcp_readiness"' in source
    assert '"public_oauth_configured"' in source
    assert '"owner_token_configured"' in source
    assert '"domain_challenge_configured"' in source
    assert '"transport_allowlist_configured"' in source
    assert "MCP_OAUTH_CLIENT_SECRET" in source
    assert "OPENAI_APPS_CHALLENGE" in source
    assert 'print(json.dumps(readiness' in source


def test_render_external_hostname_is_a_bounded_transport_fallback():
    runtime = Path("hercules-ai/app/mcp_runtime.py").read_text()
    main = Path("hercules-ai/app/main.py").read_text()

    assert "RENDER_EXTERNAL_HOSTNAME" in runtime
    assert "effective_allowed_hosts" in runtime
    assert "effective_allowed_hosts" in main
    assert '"transport_allowlist_configured":bool(effective_allowed_hosts())' in main


def test_public_tools_advertise_oauth_security_contract():
    runtime = Path("hercules-ai/app/mcp_runtime.py").read_text()
    main = Path("hercules-ai/app/main.py").read_text()

    assert 'DEFAULT_PUBLIC_MCP_SCOPES = ("hercules.read",)' in runtime
    assert 'SUPABASE_PUBLIC_MCP_SCOPES = ("openid", "email")' in runtime
    assert "PUBLIC_MCP_SCOPES = public_mcp_scopes()" in runtime
    assert '"securitySchemes"' in runtime
    assert '"security_schemes"' not in runtime
    assert '"type": "oauth2"' in runtime
    assert '"scopes_supported": list(PUBLIC_MCP_SCOPES)' in main
    assert "MCP_OAUTH_REQUIRED_SCOPES=set(PUBLIC_MCP_SCOPES)" in main


def test_oauth_tool_contract_self_verifies_and_fails_closed_when_public_oauth_is_enabled():
    runtime = Path("hercules-ai/app/mcp_runtime.py").read_text()
    main = Path("hercules-ai/app/main.py").read_text()

    assert "async def oauth_tool_contract_ready" in runtime
    assert 'tool.get("securitySchemes")' in runtime
    assert 'tool.get("_meta")' in runtime
    assert '"oauth_tool_contract_ready"' in main
    assert "if public_oauth_configured and not oauth_contract_ready" in main
    assert "Hercules MCP OAuth tool contract is not ready" in main


def test_supabase_oauth_mode_is_explicit_and_provider_compatible():
    runtime = Path("hercules-ai/app/mcp_runtime.py").read_text()
    main = Path("hercules-ai/app/main.py").read_text()

    assert 'SUPABASE_PUBLIC_MCP_SCOPES = ("openid", "email")' in runtime
    assert 'MCP_OAUTH_MODE=os.getenv("HERCULES_MCP_OAUTH_MODE","").strip().lower()' in main
    assert 'async def validate_supabase_mcp_token' in main
    assert 'MCP_OAUTH_USER_PATH="/auth/v1/oauth/userinfo"' in main
    assert '"apikey":MCP_OAUTH_PUBLISHABLE_KEY' not in main[main.index("async def validate_supabase_mcp_token"):main.index("async def validate_public_mcp_token")]
    assert 'if MCP_OAUTH_MODE=="supabase":' in main
    assert 'if MCP_OAUTH_MODE=="introspection":' in main


def test_oauth_scopes_are_provider_specific_not_globally_weakened():
    runtime = Path("hercules-ai/app/mcp_runtime.py").read_text()

    assert 'DEFAULT_PUBLIC_MCP_SCOPES = ("hercules.read",)' in runtime
    assert 'SUPABASE_PUBLIC_MCP_SCOPES = ("openid", "email")' in runtime
    assert "def public_mcp_scopes()" in runtime
    assert 'mode == "supabase"' in runtime
    assert "PUBLIC_MCP_SCOPES = public_mcp_scopes()" in runtime


def test_oauth_consent_surface_is_controlled_and_fail_closed():
    main = Path("hercules-ai/app/main.py").read_text()
    consent = Path("hercules-ai/app/oauth_consent.py").read_text()

    assert '@app.get("/oauth/consent")' in main
    assert "render_oauth_consent" in main
    assert "HERCULES_MCP_OAUTH_SUPABASE_ORIGIN" in main
    assert "HERCULES_MCP_OAUTH_PUBLISHABLE_KEY" in main
    assert "oauth_consent_not_configured" in main

    assert "getAuthorizationDetails" in consent
    assert "approveAuthorization" in consent
    assert "denyAuthorization" in consent
    assert "signInWithOtp" in consent
    assert "shouldCreateUser:false" in consent
    assert "authorization_id" in consent
    assert "textContent" in consent
    assert "innerHTML" not in consent
    assert "@supabase/supabase-js@2.57.4" in consent
    assert "service_role" not in consent.lower()
    assert "SUPABASE_SERVICE_ROLE_KEY" not in consent


def test_runtime_probes_supabase_oauth_discovery_without_secrets():
    source = Path("hercules-ai/app/main.py").read_text()

    assert "async def probe_supabase_oauth_discovery" in source
    assert '"/.well-known/oauth-authorization-server/auth/v1"' in source
    assert '"oauth_provider_discovery_ready"' in source
    assert '"oauth_dynamic_registration_advertised"' in source
    assert 'payload.get("registration_endpoint")' in source
    assert "MCP_OAUTH_CLIENT_SECRET" not in source[source.index("async def probe_supabase_oauth_discovery"):source.index("async def validate_introspection_mcp_token")]


def test_oauth_consent_supports_existing_account_password_review_login():
    consent = Path("hercules-ai/app/oauth_consent.py").read_text()

    assert 'type="password"' in consent
    assert "signInWithPassword" in consent
    assert "password" in consent
    assert "signUp" not in consent
    assert "createUser" not in consent
    assert "Password is sent directly to Supabase Auth" in consent


def test_supabase_oauth_uses_openid_email_and_standard_userinfo():
    runtime = Path("hercules-ai/app/mcp_runtime.py").read_text()
    main = Path("hercules-ai/app/main.py").read_text()

    assert 'SUPABASE_PUBLIC_MCP_SCOPES = ("openid", "email")' in runtime
    assert 'MCP_OAUTH_USER_PATH="/auth/v1/oauth/userinfo"' in main
    assert '"apikey":MCP_OAUTH_PUBLISHABLE_KEY' not in main[
        main.index("async def validate_supabase_mcp_token"):
        main.index("async def validate_public_mcp_token")
    ]
    assert 'user_subject=str(user.get("sub",""))' in main
    assert 'email_verified=user.get("email_verified") is True' in main
    assert 'required_scopes=MCP_OAUTH_REQUIRED_SCOPES' in main


def test_runtime_reports_asymmetric_openid_signing_readiness():
    source = Path("hercules-ai/app/main.py").read_text()

    assert "async def probe_supabase_asymmetric_signing" in source
    assert '"/auth/v1/.well-known/jwks.json"' in source
    assert '"oauth_asymmetric_signing_ready"' in source


def test_runtime_reports_management_token_presence_without_secret_value():
    source = Path("hercules-ai/app/main.py").read_text()

    assert '"supabase_management_token_configured"' in source
    assert 'bool(os.getenv("HERCULES_SUPABASE_ACCESS_TOKEN","").strip())' in source
    assert '"supabase_management_token":' not in source
