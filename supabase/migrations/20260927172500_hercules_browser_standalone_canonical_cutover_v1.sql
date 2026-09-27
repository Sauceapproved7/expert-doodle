-- canonical metadata: {"auth_mode": "one_time_broker", "engine": "playwright-local-chromium", "service_id": "srv-daskfp8u01pc73cbvj0g", "anti_bot_bypass": false}
update public.hercules_browser_workers
set
  base_url='https://hercules-browser-standalone.onrender.com',
  metadata = jsonb_build_object(
    'auth_mode','one_time_broker',
    'engine','playwright-local-chromium',
    'provider','render',
    'service_id','srv-daskfp8u01pc73cbvj0g',
    'service_name','hercules-browser-standalone',
    'pwa',true,
    'autopilot',true,
    'session_reuse',true,
    'anti_bot_bypass',false,
    'raw_code_execution',false,
    'network_private_targets_blocked',true,
    'embedded_credentials_blocked',true,
    'canonical_cutover_at',now(),
    'warmup_urls',jsonb_build_array('https://hercules-browser-standalone.onrender.com/health'),
    'rollback',jsonb_build_object(
      'base_url',base_url,
      'token_secret_ref',token_secret_ref,
      'engine',metadata->>'engine',
      'service_id',metadata->>'service_id',
      'service_name',metadata->>'service_name',
      'auth_mode',coalesce(metadata->>'auth_mode','vault_secret')
    )
  ),
  updated_at=now()
where name='primary'
  and enabled=true
  and base_url='https://hercules-browser-gateway-v2.onrender.com';

do $$
begin
  if not exists (
    select 1
    from public.hercules_browser_workers
    where name='primary'
      and enabled=true
      and base_url='https://hercules-browser-standalone.onrender.com'
      and metadata->>'auth_mode'='one_time_broker'
      and metadata->>'engine'='playwright-local-chromium'
  ) then
    raise exception 'standalone_browser_canonical_cutover_not_applied';
  end if;
end;
$$;
