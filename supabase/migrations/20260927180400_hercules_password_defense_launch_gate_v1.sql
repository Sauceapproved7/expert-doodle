create or replace function public.hercules_password_defense_status()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_guard_trigger_enabled boolean;
  v_issue_rpc_exists boolean;
  v_guard_function_exists boolean;
  v_ticket_table_exists boolean;
  v_service_role_can_issue boolean;
  v_anon_can_issue boolean;
  v_authenticated_can_issue boolean;
  v_ok boolean;
begin
  select exists(
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid=t.tgrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='auth'
      and c.relname='users'
      and t.tgname='hercules_password_screening_guard'
      and not t.tgisinternal
      and t.tgenabled <> 'D'
  ) into v_guard_trigger_enabled;

  v_issue_rpc_exists := pg_catalog.to_regprocedure('public.hercules_password_screening_issue(text,text,uuid,integer)') is not null;
  v_guard_function_exists := pg_catalog.to_regprocedure('private.hercules_enforce_password_screening()') is not null;
  v_ticket_table_exists := pg_catalog.to_regclass('private.hercules_password_screening_tickets') is not null;
  v_service_role_can_issue := pg_catalog.has_function_privilege('service_role','public.hercules_password_screening_issue(text,text,uuid,integer)','EXECUTE');
  v_anon_can_issue := pg_catalog.has_function_privilege('anon','public.hercules_password_screening_issue(text,text,uuid,integer)','EXECUTE');
  v_authenticated_can_issue := pg_catalog.has_function_privilege('authenticated','public.hercules_password_screening_issue(text,text,uuid,integer)','EXECUTE');

  v_ok := v_guard_trigger_enabled
    and v_issue_rpc_exists
    and v_guard_function_exists
    and v_ticket_table_exists
    and v_service_role_can_issue
    and not v_anon_can_issue
    and not v_authenticated_can_issue;

  return jsonb_build_object(
    'ok',v_ok,
    'control','hercules-password-defense-v2',
    'guard_trigger_enabled',v_guard_trigger_enabled,
    'issue_rpc_exists',v_issue_rpc_exists,
    'guard_function_exists',v_guard_function_exists,
    'ticket_table_exists',v_ticket_table_exists,
    'service_role_can_issue',v_service_role_can_issue,
    'anon_can_issue',v_anon_can_issue,
    'authenticated_can_issue',v_authenticated_can_issue,
    'checked_at',now()
  );
end;
$$;

revoke all on function public.hercules_password_defense_status() from public, anon, authenticated;
grant execute on function public.hercules_password_defense_status() to service_role;

create or replace function public.hercules_launch_approval_bundle_decide(
  p_user_id uuid,
  p_organization_id uuid,
  p_packet_version text,
  p_packet_digest text,
  p_document_shas jsonb,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_now timestamptz := now();
  v_expected_confirmation text := 'APPROVE HERCULES LAUNCH PACKET ' || upper(substr(p_packet_digest,1,12));
  v_expected_documents jsonb := jsonb_build_object(
    'pricing','85ecbdc37e4d73cdf1b6c3f9987fac8a57c47f00',
    'terms','e607d7e992458b9a7f0cca82cdeb216cae47eab5',
    'privacy','e88a83a7cb4ce5f01a3049eddfc80f84643c5b8c'
  );
  v_password_defense jsonb;
  v_evidence jsonb;
begin
  if p_packet_version <> 'hercules-launch-packet-2026-09-27-v1' then raise exception 'launch_packet_version_mismatch'; end if;
  if p_packet_digest <> '2531abae2cf8caae0af2d153feac617d4b21ce7976476c49ced57a5956615690' then raise exception 'launch_packet_digest_mismatch'; end if;
  if p_document_shas is distinct from v_expected_documents then raise exception 'launch_packet_documents_mismatch'; end if;
  if upper(btrim(coalesce(p_confirmation,''))) <> v_expected_confirmation then raise exception 'explicit_launch_packet_confirmation_required'; end if;

  if not exists (
    select 1
    from public.hercules_memberships
    where organization_id=p_organization_id
      and user_id=p_user_id
      and status='active'
      and role='owner'
  ) then raise exception 'owner_required'; end if;

  v_password_defense := public.hercules_password_defense_status();
  if coalesce((v_password_defense->>'ok')::boolean,false) is not true then
    raise exception 'auth_hardening_required_before_launch_packet';
  end if;

  v_evidence := jsonb_build_object(
    'source','hercules-launch-approval-envelope-v1',
    'packetVersion',p_packet_version,
    'packetDigest',p_packet_digest,
    'documentShas',p_document_shas,
    'confirmationVerified',true,
    'authHardeningSource','hercules-password-defense-v2',
    'authHardeningEvidence',v_password_defense,
    'decidedAt',v_now
  );

  update public.hercules_launch_approvals
     set status='approved',
         approved_by=p_user_id,
         approved_at=v_now,
         evidence=coalesce(evidence,'{}'::jsonb) || v_evidence || jsonb_build_object('approvalType',approval_type),
         updated_at=v_now
   where approval_type in ('pricing','terms','privacy');

  if (select count(*) from public.hercules_launch_approvals where approval_type in ('pricing','terms','privacy') and status='approved') <> 3 then
    raise exception 'launch_packet_atomic_update_failed';
  end if;

  insert into public.hercules_audit_log(
    organization_id,actor_user_id,action,resource_type,resource_id,changes,metadata
  ) values (
    p_organization_id,p_user_id,'launch.approval.bundle.approved',
    'hercules_launch_approval_bundle',p_packet_digest,
    jsonb_build_object('approvals',jsonb_build_array('pricing','terms','privacy'),'status','approved','packetVersion',p_packet_version,'documentShas',p_document_shas),
    jsonb_build_object('source','hercules-launch-approval-envelope-v1','explicit_confirmation',true,'atomic',true,'auth_hardening_source','hercules-password-defense-v2')
  );

  return jsonb_build_object(
    'ok',true,'packetVersion',p_packet_version,'packetDigest',p_packet_digest,
    'approvedAt',v_now,'approvals',jsonb_build_array('pricing','terms','privacy'),
    'authHardeningEvidence',v_password_defense
  );
end;
$$;

revoke all on function public.hercules_launch_approval_bundle_decide(uuid,uuid,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.hercules_launch_approval_bundle_decide(uuid,uuid,text,text,jsonb,text) to service_role;
