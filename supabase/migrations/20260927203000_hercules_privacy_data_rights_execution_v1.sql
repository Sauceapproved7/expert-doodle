create or replace function public.hercules_privacy_request_export(p_public_reference uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.hercules_privacy_requests%rowtype;
  v_user auth.users%rowtype;
  v_package jsonb;
  v_size_bytes integer;
begin
  select * into v_request
  from public.hercules_privacy_requests
  where public_reference=p_public_reference
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','privacy_request_not_found');
  end if;

  if not v_request.requester_verified then
    return jsonb_build_object('ok',false,'error','requester_not_verified','reference',v_request.public_reference);
  end if;

  if v_request.category not in ('privacy_access','privacy_export','privacy_deletion') then
    return jsonb_build_object('ok',false,'error','privacy_export_not_applicable','reference',v_request.public_reference);
  end if;

  select * into v_user
  from auth.users
  where lower(email)=lower(v_request.email)
  order by created_at asc
  limit 1;

  if v_user.id is null then
    return jsonb_build_object('ok',false,'error','subject_not_found','reference',v_request.public_reference);
  end if;

  v_package := jsonb_build_object(
    'ok',true,
    'schema_version','hercules-privacy-export-v1',
    'reference',v_request.public_reference,
    'category',v_request.category,
    'generated_at',now(),
    'subject',jsonb_build_object(
      'user_id',v_user.id,
      'email',v_user.email,
      'created_at',v_user.created_at,
      'last_sign_in_at',v_user.last_sign_in_at
    ),
    'data',jsonb_build_object(
      'hercules_projects',coalesce((select jsonb_agg(to_jsonb(x)) from public.hercules_projects x where x.user_id=v_user.id),'[]'::jsonb),
      'hercules_sessions',coalesce((select jsonb_agg(to_jsonb(x)) from public.hercules_sessions x where x.user_id=v_user.id),'[]'::jsonb),
      'hercules_chat_sessions',coalesce((select jsonb_agg(to_jsonb(x)) from public.hercules_chat_sessions x where x.user_id=v_user.id),'[]'::jsonb),
      'hercules_chat_messages',coalesce((select jsonb_agg(to_jsonb(x)) from public.hercules_chat_messages x where x.user_id=v_user.id),'[]'::jsonb),
      'hercules_chat_memories',coalesce((select jsonb_agg((to_jsonb(x) - 'embedding')) from public.hercules_chat_memories x where x.user_id=v_user.id),'[]'::jsonb),
      'hercules_chat_tool_calls',coalesce((select jsonb_agg(to_jsonb(x)) from public.hercules_chat_tool_calls x where x.user_id=v_user.id),'[]'::jsonb)
    ),
    'review_only',jsonb_build_object(
      'memberships',(select count(*) from public.hercules_memberships where user_id=v_user.id),
      'usage',(select count(*) from public.hercules_usage where user_id=v_user.id),
      'usage_events',(select count(*) from public.hercules_usage_events where user_id=v_user.id),
      'billing',(select count(*) from public.hercules_billing where user_id=v_user.id)
    ),
    'protected_not_included',jsonb_build_array(
      'hercules_audit_log',
      'hercules_security_events',
      'hercules_release_attestations',
      'hercules_release_queue',
      'hercules_release_rollouts',
      'required_tax_accounting_legal_records'
    )
  );

  v_size_bytes := octet_length(v_package::text);
  if v_size_bytes > 5242880 then
    return jsonb_build_object(
      'ok',false,
      'error','privacy_export_too_large_for_inline_delivery',
      'reference',v_request.public_reference,
      'size_bytes',v_size_bytes,
      'limit_bytes',5242880,
      'preview',public.hercules_privacy_request_preview(p_public_reference)
    );
  end if;

  return v_package || jsonb_build_object('size_bytes',v_size_bytes);
end;
$$;

revoke all on function public.hercules_privacy_request_export(uuid) from public, anon, authenticated;
grant execute on function public.hercules_privacy_request_export(uuid) to service_role;

create or replace function public.hercules_privacy_request_deletion_plan(p_public_reference uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.hercules_privacy_requests%rowtype;
  v_user_id uuid;
  v_privileged_memberships integer := 0;
begin
  select * into v_request
  from public.hercules_privacy_requests
  where public_reference=p_public_reference
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','privacy_request_not_found');
  end if;

  if not v_request.requester_verified then
    return jsonb_build_object('ok',false,'error','requester_not_verified','reference',v_request.public_reference);
  end if;

  if v_request.category <> 'privacy_deletion' then
    return jsonb_build_object('ok',false,'error','privacy_deletion_request_required','reference',v_request.public_reference);
  end if;

  select id into v_user_id
  from auth.users
  where lower(email)=lower(v_request.email)
  order by created_at asc
  limit 1;

  if v_user_id is null then
    return jsonb_build_object('ok',false,'error','subject_not_found','reference',v_request.public_reference);
  end if;

  select count(*) into v_privileged_memberships
  from public.hercules_memberships
  where user_id=v_user_id
    and status='active'
    and role in ('owner','admin');

  return jsonb_build_object(
    'ok',true,
    'reference',v_request.public_reference,
    'subject_user_id',v_user_id,
    'mode','deletion_plan',
    'confirmation','DELETE ' || upper(v_request.public_reference::text),
    'privileged_membership_block',v_privileged_memberships > 0,
    'deletable_user_content',jsonb_build_object(
      'hercules_chat_tool_calls',(select count(*) from public.hercules_chat_tool_calls where user_id=v_user_id),
      'hercules_chat_memories',(select count(*) from public.hercules_chat_memories where user_id=v_user_id),
      'hercules_chat_messages',(select count(*) from public.hercules_chat_messages where user_id=v_user_id),
      'hercules_chat_sessions',(select count(*) from public.hercules_chat_sessions where user_id=v_user_id),
      'hercules_sessions',(select count(*) from public.hercules_sessions where user_id=v_user_id),
      'hercules_projects',(select count(*) from public.hercules_projects where user_id=v_user_id)
    ),
    'preserved_for_review',jsonb_build_array(
      'auth.users',
      'hercules_memberships',
      'hercules_usage',
      'hercules_usage_events',
      'hercules_billing',
      'hercules_audit_log',
      'hercules_security_events',
      'required_tax_accounting_legal_records'
    ),
    'full_account_deletion_complete',false
  );
end;
$$;

revoke all on function public.hercules_privacy_request_deletion_plan(uuid) from public, anon, authenticated;
grant execute on function public.hercules_privacy_request_deletion_plan(uuid) to service_role;

create or replace function public.hercules_privacy_request_delete_user_content(
  p_public_reference uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.hercules_privacy_requests%rowtype;
  v_user_id uuid;
  v_expected text;
  v_privileged_memberships integer := 0;
  v_tool_calls integer := 0;
  v_memories integer := 0;
  v_messages integer := 0;
  v_chat_sessions integer := 0;
  v_sessions integer := 0;
  v_projects integer := 0;
  v_now timestamptz := now();
begin
  select * into v_request
  from public.hercules_privacy_requests
  where public_reference=p_public_reference
  for update;

  if not found then
    return jsonb_build_object('ok',false,'error','privacy_request_not_found');
  end if;

  if not v_request.requester_verified then
    return jsonb_build_object('ok',false,'error','requester_not_verified','reference',v_request.public_reference);
  end if;

  if v_request.category <> 'privacy_deletion' then
    return jsonb_build_object('ok',false,'error','privacy_deletion_request_required','reference',v_request.public_reference);
  end if;

  v_expected := 'DELETE ' || upper(v_request.public_reference::text);
  if coalesce(p_confirmation,'') <> v_expected then
    return jsonb_build_object('ok',false,'error','explicit_confirmation_required','expected',v_expected);
  end if;

  select id into v_user_id
  from auth.users
  where lower(email)=lower(v_request.email)
  order by created_at asc
  limit 1;

  if v_user_id is null then
    return jsonb_build_object('ok',false,'error','subject_not_found','reference',v_request.public_reference);
  end if;

  select count(*) into v_privileged_memberships
  from public.hercules_memberships
  where user_id=v_user_id
    and status='active'
    and role in ('owner','admin');

  if v_privileged_memberships > 0 then
    return jsonb_build_object(
      'ok',false,
      'error','privileged_membership_requires_account_review',
      'reference',v_request.public_reference,
      'full_account_deletion_complete',false
    );
  end if;

  delete from public.hercules_chat_tool_calls where user_id=v_user_id;
  get diagnostics v_tool_calls = row_count;

  delete from public.hercules_chat_memories where user_id=v_user_id;
  get diagnostics v_memories = row_count;

  delete from public.hercules_chat_messages where user_id=v_user_id;
  get diagnostics v_messages = row_count;

  delete from public.hercules_chat_sessions where user_id=v_user_id;
  get diagnostics v_chat_sessions = row_count;

  delete from public.hercules_sessions where user_id=v_user_id;
  get diagnostics v_sessions = row_count;

  delete from public.hercules_projects where user_id=v_user_id;
  get diagnostics v_projects = row_count;

  update public.hercules_privacy_requests
  set status='in_progress',
      resolution=coalesce(resolution,'{}'::jsonb) || jsonb_build_object(
        'user_content_deleted_at',v_now,
        'user_content_deleted',true,
        'full_account_deletion_complete',false,
        'preserved_for_review',jsonb_build_array(
          'auth.users',
          'hercules_memberships',
          'hercules_usage',
          'hercules_usage_events',
          'hercules_billing',
          'hercules_audit_log',
          'hercules_security_events',
          'required_tax_accounting_legal_records'
        )
      ),
      updated_at=v_now
  where public_reference=v_request.public_reference;

  return jsonb_build_object(
    'ok',true,
    'reference',v_request.public_reference,
    'mode','user_content_deleted',
    'deleted',jsonb_build_object(
      'hercules_chat_tool_calls',v_tool_calls,
      'hercules_chat_memories',v_memories,
      'hercules_chat_messages',v_messages,
      'hercules_chat_sessions',v_chat_sessions,
      'hercules_sessions',v_sessions,
      'hercules_projects',v_projects
    ),
    'preserved_for_review',jsonb_build_array(
      'auth.users',
      'hercules_memberships',
      'hercules_usage',
      'hercules_usage_events',
      'hercules_billing',
      'hercules_audit_log',
      'hercules_security_events',
      'required_tax_accounting_legal_records'
    ),
    'full_account_deletion_complete',false,
    'post_delete_verification',jsonb_build_object(
      'hercules_chat_tool_calls',(select count(*) from public.hercules_chat_tool_calls where user_id=v_user_id),
      'hercules_chat_memories',(select count(*) from public.hercules_chat_memories where user_id=v_user_id),
      'hercules_chat_messages',(select count(*) from public.hercules_chat_messages where user_id=v_user_id),
      'hercules_chat_sessions',(select count(*) from public.hercules_chat_sessions where user_id=v_user_id),
      'hercules_sessions',(select count(*) from public.hercules_sessions where user_id=v_user_id),
      'hercules_projects',(select count(*) from public.hercules_projects where user_id=v_user_id)
    )
  );
end;
$$;

revoke all on function public.hercules_privacy_request_delete_user_content(uuid,text) from public, anon, authenticated;
grant execute on function public.hercules_privacy_request_delete_user_content(uuid,text) to service_role;

comment on function public.hercules_privacy_request_export(uuid) is
  'Service-role-only verified privacy export package. Excludes protected audit/security/billing review records and fails closed for unverified requests.';
comment on function public.hercules_privacy_request_deletion_plan(uuid) is
  'Service-role-only deletion plan bound to one verified privacy deletion request.';
comment on function public.hercules_privacy_request_delete_user_content(uuid,text) is
  'Service-role-only user-content deletion executor. Requires exact confirmation, blocks privileged memberships, preserves auth/membership/billing/audit/security/legal records, and returns post-delete verification.';
