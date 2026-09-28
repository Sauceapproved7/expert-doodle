-- Hercules Cleaner verified live catalog URL v1
-- Binds only the exact deployment already verified by the Hercules owned deploy controller.

do $migration$
declare
  v_verified boolean := false;
begin
  select exists(
    select 1
    from public.hercules_deployment_runs
    where deployment_id='deploy-dd7e24a1-e7d5-4715-ac1e-737906b876ec'
      and status='deployed'
      and verification_status='verified'
      and result->>'stableUrl'='https://sauceapproved-forge-host.onrender.com/hercules-cleaner/'
      and verification->>'bodySha256'='840c402f6ab5d0d0677388902369582618449ad7b898067f424dcc807fc35952'
      and (verification->>'status')::integer=200
  ) into v_verified;

  if not v_verified then
    raise exception 'hercules_cleaner_verified_deployment_required';
  end if;

  update public.hercules_software_products
  set
    live_url='https://sauceapproved-forge-host.onrender.com/hercules-cleaner/',
    checkout_enabled=false,
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'verified_deployment_id','deploy-dd7e24a1-e7d5-4715-ac1e-737906b876ec',
      'verification_status','verified',
      'verified_body_sha256','840c402f6ab5d0d0677388902369582618449ad7b898067f424dcc807fc35952',
      'presentation_provider','render'
    ),
    updated_at=now()
  where code='hercules-cleaner'
    and status='early_access';

  if not found then
    raise exception 'hercules_cleaner_early_access_catalog_row_required';
  end if;

  update public.hercules_software_product_plans
  set checkout_enabled=false,
      pricing_status='owner_approval_required',
      updated_at=now()
  where product_code='hercules-cleaner';
end
$migration$;
