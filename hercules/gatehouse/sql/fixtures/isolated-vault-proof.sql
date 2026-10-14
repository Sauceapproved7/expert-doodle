-- Executes ONLY in ephemeral isolated Docker PostgreSQL with real Vault extension.
-- Every token and owner ID below is synthetic.
DO $$
DECLARE
 org uuid := 'ea5fb196-67f9-42fa-b592-49eeb3b84346';
 owner_id uuid := '0388a570-7e32-4d63-9bee-9df0c877bbf9';
 other_id uuid := '8388a570-7e32-4d63-9bee-9df0c877bbf9';
 a1 text := 'shpat_SYNTHETIC_VAULT_ACCESS_A_012345678901';
 r1 text := 'shprt_SYNTHETIC_VAULT_REFRESH_A_012345678901';
 a2 text := 'shpat_SYNTHETIC_VAULT_ACCESS_B_012345678901';
 r2 text := 'shprt_SYNTHETIC_VAULT_REFRESH_B_012345678901';
 result jsonb;
 lease jsonb;
 nonce uuid;
 initial_secrets bigint;
 denied boolean;
 old_ref uuid;
 old_count bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='supabase_vault') THEN
  RAISE EXCEPTION 'real_vault_extension_unavailable';
 END IF;
 IF pg_catalog.to_regclass('hercules_private.gatehouse_shopify_offline_grants') IS NULL THEN
  RAISE EXCEPTION 'real_vault_table_not_installed';
 END IF;
 IF has_table_privilege('authenticated','hercules_private.gatehouse_shopify_offline_grants','SELECT') THEN
  RAISE EXCEPTION 'consumer_can_read_private_table';
 END IF;
 IF has_function_privilege('authenticated','public.gatehouse_offline_acquire(uuid,uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'consumer_can_acquire_private_credentials';
 END IF;
 PERFORM set_config('request.jwt.claim.role','authenticated',false);
 denied := false;
 BEGIN
  PERFORM public.gatehouse_offline_acquire(org,owner_id);
 EXCEPTION WHEN insufficient_privilege THEN
  denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'wrong_jwt_role_accepted'; END IF;
 PERFORM set_config('request.jwt.claim.role','service_role',false);
 denied := false;
 BEGIN
  PERFORM public.gatehouse_offline_acquire(org,other_id);
 EXCEPTION WHEN insufficient_privilege THEN
  denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'non_owner_membership_accepted'; END IF;
 SELECT count(*) INTO initial_secrets FROM vault.secrets;
 SELECT public.gatehouse_offline_bootstrap(
  org,owner_id,a1,r1,clock_timestamp()+interval '45 minutes',
  clock_timestamp()+interval '60 days') INTO result;
 IF result->>'stored' <> 'true' OR result->>'generation' <> '1' THEN
  RAISE EXCEPTION 'initial_vault_dual_token_bootstrap_failed';
 END IF;
 IF (SELECT count(*) FROM vault.secrets) <> initial_secrets + 2 THEN
  RAISE EXCEPTION 'encrypted_vault_secret_pair_missing';
 END IF;
 IF EXISTS(SELECT 1 FROM vault.secrets WHERE secret IN (a1,r1)) THEN
  RAISE EXCEPTION 'vault_stored_plaintext';
 END IF;
 SELECT public.gatehouse_offline_bootstrap(
  org,owner_id,a2,r2,clock_timestamp()+interval '45 minutes',
  clock_timestamp()+interval '60 days') INTO result;
 IF result->>'stored' <> 'false' OR
  (SELECT count(*) FROM vault.secrets) <> initial_secrets + 2 THEN
  RAISE EXCEPTION 'duplicate_bootstrap_mutated_vault';
 END IF;
 SELECT public.gatehouse_offline_acquire(org,owner_id) INTO lease;
 IF lease->>'leased' <> 'true' OR
    lease->>'refresh_token' <> r1 OR
    lease->>'shop_domain' <> 'azymhc-x0.myshopify.com' OR
    lease->>'generation' <> '1' THEN
  RAISE EXCEPTION 'first_owner_lease_invalid';
 END IF;
 nonce := (lease->>'lease_nonce')::uuid;
 INSERT INTO public.gatehouse_test_observation(id,lease_nonce) VALUES(1,nonce);
 SELECT public.gatehouse_offline_acquire(org,owner_id) INTO result;
 IF result->>'leased' <> 'false' THEN
  RAISE EXCEPTION 'second_concurrent_lease_not_denied';
 END IF;
 old_count := (SELECT count(*) FROM vault.secrets);
 SELECT access_secret_ref INTO old_ref
 FROM hercules_private.gatehouse_shopify_offline_grants WHERE organization_id=org;
 SELECT public.gatehouse_offline_commit(
  org,owner_id,gen_random_uuid(),1,a2,r2,clock_timestamp()+interval '45 minutes',
  clock_timestamp()+interval '60 days') INTO result;
 IF result->>'stored' <> 'false' OR (SELECT count(*) FROM vault.secrets) <> old_count THEN
  RAISE EXCEPTION 'incorrect_nonce_permitted_rotation';
 END IF;
 SELECT public.gatehouse_offline_commit(
  org,owner_id,nonce,2,a2,r2,clock_timestamp()+interval '45 minutes',
  clock_timestamp()+interval '60 days') INTO result;
 IF result->>'stored' <> 'false' OR (SELECT count(*) FROM vault.secrets) <> old_count THEN
  RAISE EXCEPTION 'stale_generation_permitted_rotation';
 END IF;
 SELECT public.gatehouse_offline_commit(
  org,owner_id,nonce,1,a2,r2,clock_timestamp()+interval '45 minutes',
  clock_timestamp()+interval '60 days') INTO result;
 IF result->>'stored' <> 'true' OR result->>'generation' <> '2' OR
   (SELECT count(*) FROM vault.secrets) <> old_count+2 THEN
  RAISE EXCEPTION 'atomic_dual_token_rotation_failed';
 END IF;
 IF (SELECT access_secret_ref FROM hercules_private.gatehouse_shopify_offline_grants
    WHERE organization_id=org) = old_ref THEN
  RAISE EXCEPTION 'new_access_token_ref_not_swapped';
 END IF;
 SELECT public.gatehouse_offline_commit(
  org,owner_id,nonce,1,a2,r2,clock_timestamp()+interval '45 minutes',
  clock_timestamp()+interval '60 days') INTO result;
 IF result->>'stored' <> 'false' OR
    (SELECT count(*) FROM vault.secrets) <> old_count+2 THEN
  RAISE EXCEPTION 'duplicate_commit_mutated_vault';
 END IF;
 SELECT public.gatehouse_offline_release(org,owner_id,gen_random_uuid()) INTO result;
 IF result->>'released' <> 'false' THEN
  RAISE EXCEPTION 'wrong_release_nonce_accepted';
 END IF;
 SELECT public.gatehouse_offline_release(org,owner_id,nonce) INTO result;
 IF result->>'released' <> 'true' THEN
  RAISE EXCEPTION 'correct_release_nonce_denied';
 END IF;
END;
$$;
SELECT 'real_vault_dual_token_bootstrap_lease_cas_passed' AS result;
