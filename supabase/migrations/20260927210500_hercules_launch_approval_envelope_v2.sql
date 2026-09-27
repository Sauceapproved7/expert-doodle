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
    'privacy','5bb5022e464c68ba27e80a1a2bfaa430c624cc44'
  );
  v_password_defense jsonb;
  v_evidence jsonb;
begin
  if p_packet_version <> 'hercules-launch-packet-2026-09-27-v2' then
    raise exception 'launch_packet_version_mismatch';
  end if;

  if p_packet_digest <> 'e2166a626887f9c5995f409d6ce91900ef2175bcc6e221b6bffec46ce657a086' then
    raise exception 'launch_packet_digest_mismatch';
  end if;

  if p_document_shas is distinct from v_expected_documents then
    raise exception 'launch_packet_documents_mismatch';
  end if;

  if upper(btrim(coalesce(p_confirmation,''))) <> v_expected_confirmation then
    raise exception 'explicit_launch_packet_confirmation_required';
  end if;

  if not exists (
    select 1
    from public.hercules_memberships
    where organization_id=p_organization_id
      and user_id=p_user_id
      and status='active'
      and role='owner'
  ) then
    raise exception 'owner_required';
  end if;

  v_password_defense := public.hercules_password_defense_status();
  if coalesce((v_password_defense->>'ok')::boolean,false) is not true then
    raise exception 'auth_hardening_required_before_launch_packet';
  end if;

  v_evidence := jsonb_build_object(
    'source','hercules-launch-approval-envelope-v2',
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

  if (
    select count(*)
    from public.hercules_launch_approvals
    where approval_type in ('pricing','terms','privacy')
      and status='approved'
  ) <> 3 then
    raise exception 'launch_packet_atomic_update_failed';
  end if;

  insert into public.hercules_audit_log(
    organization_id,actor_user_id,action,resource_type,resource_id,changes,metadata
  ) values (
    p_organization_id,
    p_user_id,
    'launch.approval.bundle.approved',
    'hercules_launch_approval_bundle',
    p_packet_digest,
    jsonb_build_object(
      'approvals',jsonb_build_array('pricing','terms','privacy'),
      'status','approved',
      'packetVersion',p_packet_version,
      'documentShas',p_document_shas
    ),
    jsonb_build_object(
      'source','hercules-launch-approval-envelope-v2',
      'explicit_confirmation',true,
      'atomic',true,
      'auth_hardening_source','hercules-password-defense-v2'
    )
  );

  return jsonb_build_object(
    'ok',true,
    'packetVersion',p_packet_version,
    'packetDigest',p_packet_digest,
    'approvedAt',v_now,
    'approvals',jsonb_build_array('pricing','terms','privacy'),
    'authHardeningEvidence',v_password_defense
  );
end;
$$;

revoke all on function public.hercules_launch_approval_bundle_decide(uuid,uuid,text,text,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.hercules_launch_approval_bundle_decide(uuid,uuid,text,text,jsonb,text)
  to service_role;

comment on function public.hercules_launch_approval_bundle_decide(uuid,uuid,text,text,jsonb,text) is
  'Owner-only atomic approval for Hercules launch packet v2. Packet v2 pins the current Pricing, Terms, and Privacy v0.4 document SHAs and requires live Hercules Password Defense evidence.';
