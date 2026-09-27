create or replace function public.hercules_guard_auth_hardening_native_approval()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_native_enabled boolean :=
    lower(coalesce(new.evidence #>> '{nativeVerification,leakedPasswordProtectionEnabled}','false'))='true';
  v_warning_present boolean :=
    lower(coalesce(new.evidence #>> '{nativeVerification,advisorWarningPresent}','true'))='true';
  v_verified_at text := nullif(btrim(coalesce(new.evidence #>> '{nativeVerification,verifiedAt}','')),'');
  v_source text := lower(btrim(coalesce(new.evidence #>> '{nativeVerification,source}','')));
begin
  if new.approval_type='auth_hardening' and new.status='approved' then
    if not v_native_enabled
       or v_warning_present
       or v_verified_at is null
       or v_source <> 'supabase-security-advisor' then
      raise exception 'auth_hardening_native_verification_required';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.hercules_guard_auth_hardening_native_approval()
from public, anon, authenticated;

update public.hercules_launch_approvals
set status='pending',
    approved_by=null,
    approved_at=null,
    evidence=coalesce(evidence,'{}'::jsonb) || jsonb_build_object(
      'nativeApprovalGuard',jsonb_build_object(
        'status','enforced',
        'reason','Native Supabase leaked-password protection verification is required for auth_hardening approval.'
      )
    ),
    updated_at=now()
where approval_type='auth_hardening'
  and status='approved'
  and (
    lower(coalesce(evidence #>> '{nativeVerification,leakedPasswordProtectionEnabled}','false')) <> 'true'
    or lower(coalesce(evidence #>> '{nativeVerification,advisorWarningPresent}','true')) <> 'false'
    or nullif(btrim(coalesce(evidence #>> '{nativeVerification,verifiedAt}','')),'') is null
    or lower(btrim(coalesce(evidence #>> '{nativeVerification,source}',''))) <> 'supabase-security-advisor'
  );

drop trigger if exists hercules_auth_hardening_native_approval_guard
on public.hercules_launch_approvals;

create trigger hercules_auth_hardening_native_approval_guard
before insert or update on public.hercules_launch_approvals
for each row
execute function public.hercules_guard_auth_hardening_native_approval();
