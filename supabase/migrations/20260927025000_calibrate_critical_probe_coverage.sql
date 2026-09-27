begin;

update public.hercules_slo_definitions
set
  window_minutes = 45,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'monitor_cadence', 'rotating six-service batch every five minutes across 43 enabled services',
    'calibration_reason', 'align critical probe freshness window with one complete production monitor sweep',
    'calibrated_at', '2026-09-27'
  ),
  updated_at = now()
where slo_id = 'critical-probe-coverage'
  and organization_id = 'ea5fb196-67f9-42fa-b592-49eeb3b84346'
  and window_minutes = 15
  and target = 0.90
  and enabled = true;

do $$
begin
  if not exists (
    select 1
    from public.hercules_slo_definitions
    where slo_id = 'critical-probe-coverage'
      and organization_id = 'ea5fb196-67f9-42fa-b592-49eeb3b84346'
      and window_minutes = 45
      and target = 0.90
      and enabled = true
  ) then
    raise exception 'critical-probe-coverage calibration did not apply';
  end if;
end
$$;

commit;
