do $$
declare
  v_secret text;
  v_secret_ref uuid;
begin
  if not exists (
    select 1 from public.hercules_internal_service_keys
    where purpose='forge-interpreter' and enabled=true
  ) then
    v_secret := encode(gen_random_bytes(32),'hex');
    select vault.create_secret(
      v_secret,
      'hercules-forge-interpreter',
      'Hercules Forge dedicated AI interpreter service credential'
    ) into v_secret_ref;

    insert into public.hercules_internal_service_keys(
      purpose,key_sha256,enabled,rotated_at,metadata,secret_ref
    ) values (
      'forge-interpreter',
      encode(digest(v_secret,'sha256'),'hex'),
      true,
      now(),
      jsonb_build_object(
        'scope','hercules-ai-route-internal',
        'credential_custody','supabase_vault',
        'consumer','sauceapproved-forge-control',
        'carries_credentials',false,
        'version','v1'
      ),
      v_secret_ref
    );
    v_secret := null;
  end if;
end $$;
