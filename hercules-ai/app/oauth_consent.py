import json


def render_oauth_consent(supabase_origin: str, publishable_key: str) -> str:
    origin = json.dumps(supabase_origin)
    key = json.dumps(publishable_key)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Authorize Hercules</title>
  <style>
    :root {{ color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }}
    body {{ margin:0; min-height:100vh; display:grid; place-items:center; background:#080a0d; color:#f4f1e8; }}
    main {{ width:min(92vw,560px); border:1px solid #2b3038; border-radius:22px; padding:28px; background:#10141a; box-shadow:0 24px 80px #0008; }}
    h1 {{ margin:0 0 8px; font-size:1.8rem; }}
    p {{ color:#b7bec8; line-height:1.55; }}
    .panel {{ margin:18px 0; padding:16px; border-radius:14px; background:#0b0e13; border:1px solid #252a32; }}
    .row {{ margin:10px 0; }}
    .label {{ display:block; color:#8f98a5; font-size:.8rem; text-transform:uppercase; letter-spacing:.08em; }}
    input {{ box-sizing:border-box; width:100%; margin:8px 0 12px; padding:12px; border-radius:10px; border:1px solid #343b46; background:#080a0d; color:#fff; }}
    button {{ border:0; border-radius:10px; padding:11px 16px; font-weight:700; cursor:pointer; }}
    .approve {{ background:#ff6b22; color:#090909; }}
    .deny {{ background:#272d36; color:#f4f1e8; }}
    .actions {{ display:flex; gap:10px; flex-wrap:wrap; }}
    .hidden {{ display:none; }}
    #status {{ min-height:1.4em; color:#d4dae2; }}
  </style>
</head>
<body>
<main>
  <h1>Authorize Hercules</h1>
  <p>Review the requesting application before granting access to the bounded Hercules read-only MCP surface.</p>
  <section id="signin" class="panel hidden">
    <span class="label">Existing account required</span>
    <p>Enter the email for an existing SauceApproved account. This flow cannot create a new account.</p>
    <input id="email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com">
    <input id="password" type="password" autocomplete="current-password" placeholder="Password">
    <p>Password is sent directly to Supabase Auth and is never received or stored by Hercules.</p>
    <div class="actions">
      <button id="sign-in-password" class="approve" type="button">Sign in with password</button>
      <button id="send-link" class="deny" type="button">Send sign-in link</button>
    </div>
  </section>
  <section id="consent" class="panel hidden">
    <div class="row"><span class="label">Application</span><span id="client-name"></span></div>
    <div class="row"><span class="label">Redirect</span><span id="redirect-uri"></span></div>
    <div class="row"><span class="label">Requested permissions</span><span id="scope"></span></div>
    <div class="actions">
      <button id="approve" class="approve" type="button">Approve</button>
      <button id="deny" class="deny" type="button">Deny</button>
    </div>
  </section>
  <p id="status" role="status" aria-live="polite"></p>
</main>
<script type="module">
import {{ createClient }} from "https://esm.sh/@supabase/supabase-js@2.80.0";

const SUPABASE_ORIGIN = {origin};
const PUBLISHABLE_KEY = {key};
const authorization_id = new URLSearchParams(window.location.search).get("authorization_id");
const client = createClient(SUPABASE_ORIGIN, PUBLISHABLE_KEY);
const byId = (id) => document.getElementById(id);
const setStatus = (message) => {{ byId("status").textContent = message; }};
const show = (id) => {{ byId(id).classList.remove("hidden"); }};
const hide = (id) => {{ byId(id).classList.add("hidden"); }};

function displayAuthorization(details) {{
  byId("client-name").textContent = details?.client?.name || "Unknown application";
  byId("redirect-uri").textContent = details?.redirect_uri || "Not provided";
  byId("scope").textContent = details?.scope?.trim() || "Read-only Hercules access";
  hide("signin");
  show("consent");
  setStatus("");
}}

async function loadAuthorization() {{
  if (!authorization_id) {{
    setStatus("Missing authorization request.");
    return;
  }}
  const {{ data: userData, error: userError }} = await client.auth.getUser();
  if (userError || !userData?.user) {{
    show("signin");
    setStatus("Sign in to continue.");
    return;
  }}
  const {{ data, error }} = await client.auth.oauth.getAuthorizationDetails(authorization_id);
  if (error || !data) {{
    setStatus("Authorization request is invalid or expired.");
    return;
  }}
  if (!("authorization_id" in data)) {{
    window.location.assign(data.redirect_url);
    return;
  }}
  displayAuthorization(data);
}}

byId("sign-in-password").addEventListener("click", async () => {{
  const email = byId("email").value.trim();
  const password = byId("password").value;
  if (!email || !password) {{
    setStatus("Enter your existing account email and password.");
    return;
  }}
  setStatus("Signing in…");
  const {{ error }} = await client.auth.signInWithPassword({{ email, password }});
  byId("password").value = "";
  if (error) {{
    setStatus("Sign-in failed.");
    return;
  }}
  await loadAuthorization();
}});

byId("send-link").addEventListener("click", async () => {{
  const email = byId("email").value.trim();
  if (!email) {{
    setStatus("Enter your existing account email.");
    return;
  }}
  setStatus("Sending sign-in link…");
  const {{ error }} = await client.auth.signInWithOtp({{
    email,
    options:{{shouldCreateUser:false,emailRedirectTo:window.location.href}}
  }});
  setStatus(error ? "Sign-in could not be started." : "Check your email to continue.");
}});

byId("approve").addEventListener("click", async () => {{
  setStatus("Approving…");
  const {{ data, error }} = await client.auth.oauth.approveAuthorization(authorization_id);
  if (error || !data?.redirect_url) {{
    setStatus("Authorization could not be approved.");
    return;
  }}
  window.location.assign(data.redirect_url);
}});

byId("deny").addEventListener("click", async () => {{
  setStatus("Denying…");
  const {{ data, error }} = await client.auth.oauth.denyAuthorization(authorization_id);
  if (error || !data?.redirect_url) {{
    setStatus("Authorization could not be denied.");
    return;
  }}
  window.location.assign(data.redirect_url);
}});

loadAuthorization().catch(() => setStatus("Authorization is temporarily unavailable."));
</script>
</body>
</html>"""
