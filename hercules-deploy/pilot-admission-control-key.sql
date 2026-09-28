-- Hercules controlled Founding Pilot admission internal key.
-- Provisioning only: no schema change. Stores the plaintext only in Vault and
-- the SHA-256 digest in hercules_internal_service_keys.

do $$
declare
  v_internal_key text;
  v_secret_ref uuid;
begin
  v_internal_key := encode(extensions.gen_random_bytes(32),'hex');
  v_secret_ref := public.hercules_store_secret(
    v_internal_key,
    'hercules-pilot-admission-control-internal',
    'Hercules internal control credential for issuing qualified Founding Pilot handoffs.'
  );

  insert into public.hercules_internal_service_keys(
    purpose,key_sha256,enabled,rotated_at,metadata,secret_ref
  ) values (
    'pilot-admission-control',
    encode(extensions.digest(v_internal_key,'sha256'),'hex'),
    true,
    now(),
    jsonb_build_object(
      'scope','controlled-founding-pilot-admission',
      'owner','Hercules',
      'credentialType','internal-control',
      'plaintextStoredInRegistry',false
    ),
    v_secret_ref
  )
  on conflict (purpose) do update set
    key_sha256=excluded.key_sha256,
    enabled=true,
    rotated_at=excluded.rotated_at,
    metadata=excluded.metadata,
    secret_ref=excluded.secret_ref;

  v_internal_key := null;
end
$$;
