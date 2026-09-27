create or replace function public.hercules_privacy_request_preview(p_public_reference uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.hercules_privacy_requests%rowtype;
  v_user_id uuid;
begin
  select *
  into v_request
  from public.hercules_privacy_requests
  where public_reference=p_public_reference
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','privacy_request_not_found');
  end if;

  if not v_request.requester_verified then
    return jsonb_build_object(
      'ok',false,
      'error','requester_not_verified',
      'reference',v_request.public_reference,
      'executable',false
    );
  end if;

  if v_request.category not in ('privacy_access','privacy_export','privacy_correction','privacy_deletion') then
    return jsonb_build_object(
      'ok',false,
      'error','data_rights_preview_not_applicable',
      'reference',v_request.public_reference,
      'executable',false
    );
  end if;

  select u.id
  into v_user_id
  from auth.users u
  where lower(u.email)=lower(v_request.email)
  order by u.created_at asc
  limit 1;

  if v_user_id is null then
    return jsonb_build_object(
      'ok',false,
      'error','subject_not_found',
      'reference',v_request.public_reference,
      'executable',false
    );
  end if;

  return jsonb_build_object(
    'ok',true,
    'reference',v_request.public_reference,
    'category',v_request.category,
    'subject_user_id',v_user_id,
    'requester_verified',true,
    'executable',false,
    'mode','preview_only',
    'user_scoped_content',jsonb_build_object(
      'hercules_projects',(select count(*) from public.hercules_projects where user_id=v_user_id),
      'hercules_sessions',(select count(*) from public.hercules_sessions where user_id=v_user_id),
      'hercules_chat_sessions',(select count(*) from public.hercules_chat_sessions where user_id=v_user_id),
      'hercules_chat_messages',(select count(*) from public.hercules_chat_messages where user_id=v_user_id),
      'hercules_chat_memories',(select count(*) from public.hercules_chat_memories where user_id=v_user_id),
      'hercules_chat_tool_calls',(select count(*) from public.hercules_chat_tool_calls where user_id=v_user_id)
    ),
    'review_before_deletion',jsonb_build_object(
      'hercules_memberships',(select count(*) from public.hercules_memberships where user_id=v_user_id),
      'hercules_usage',(select count(*) from public.hercules_usage where user_id=v_user_id),
      'hercules_usage_events',(select count(*) from public.hercules_usage_events where user_id=v_user_id),
      'hercules_billing',(select count(*) from public.hercules_billing where user_id=v_user_id),
      'organization_scope_requires_review',true
    ),
    'protected_by_default',jsonb_build_array(
      'hercules_audit_log',
      'hercules_security_events',
      'hercules_release_attestations',
      'hercules_release_queue',
      'hercules_release_rollouts',
      'required_tax_accounting_legal_records'
    ),
    'organizations',coalesce((
      select jsonb_agg(jsonb_build_object(
        'organization_id',m.organization_id,
        'role',m.role,
        'status',m.status
      ) order by m.created_at)
      from public.hercules_memberships m
      where m.user_id=v_user_id
    ),'[]'::jsonb),
    'next_action','owner_review_required_before_export_or_deletion'
  );
end;
$$;

revoke all on function public.hercules_privacy_request_preview(uuid) from public, anon, authenticated;
grant execute on function public.hercules_privacy_request_preview(uuid) to service_role;

comment on function public.hercules_privacy_request_preview(uuid) is
  'Preview-only data-rights scope for a verified Privacy Request Center ticket. Returns counts/classification and never mutates customer data.';
