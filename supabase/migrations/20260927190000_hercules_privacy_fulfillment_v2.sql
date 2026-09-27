create or replace function public.hercules_privacy_request_export(p_public_reference uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.hercules_privacy_requests%rowtype;
  v_user_id uuid;
  v_user_email text;
  v_user_created timestamptz;
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
    return jsonb_build_object('ok',false,'error','requester_not_verified','reference',v_request.public_reference);
  end if;

  if v_request.category not in ('privacy_access','privacy_export') then
    return jsonb_build_object('ok',false,'error','export_not_applicable','reference',v_request.public_reference);
  end if;

  select u.id,u.email,u.created_at
  into v_user_id,v_user_email,v_user_created
  from auth.users u
  where lower(u.email)=lower(v_request.email)
  order by u.created_at asc
  limit 1;

  if v_user_id is null then
    return jsonb_build_object('ok',false,'error','subject_not_found','reference',v_request.public_reference);
  end if;

  return jsonb_build_object(
    'ok',true,
    'mode','verified_export',
    'reference',v_request.public_reference,
    'category',v_request.category,
    'generated_at',now(),
    'subject',jsonb_build_object(
      'user_id',v_user_id,
      'email',v_user_email,
      'account_created_at',v_user_created
    ),
    'data',jsonb_build_object(
      'projects',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',p.id,'name',p.name,'goal',p.goal,'created_at',p.created_at,'updated_at',p.updated_at
        ) order by p.created_at)
        from public.hercules_projects p where p.user_id=v_user_id
      ),'[]'::jsonb),
      'sessions',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',s.id,'project_id',s.project_id,'prompt',s.prompt,'result',s.result,'created_at',s.created_at
        ) order by s.created_at)
        from public.hercules_sessions s where s.user_id=v_user_id
      ),'[]'::jsonb),
      'chat_sessions',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',s.id,'organization_id',s.organization_id,'title',s.title,'status',s.status,
          'metadata',s.metadata,'created_at',s.created_at,'updated_at',s.updated_at,'last_message_at',s.last_message_at
        ) order by s.created_at)
        from public.hercules_chat_sessions s where s.user_id=v_user_id
      ),'[]'::jsonb),
      'chat_messages',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',m.id,'session_id',m.session_id,'parent_message_id',m.parent_message_id,
          'role',m.role,'status',m.status,'content',m.content,'model',m.model,
          'input_tokens',m.input_tokens,'output_tokens',m.output_tokens,
          'client_message_id',m.client_message_id,'metadata',m.metadata,'created_at',m.created_at
        ) order by m.created_at)
        from public.hercules_chat_messages m where m.user_id=v_user_id
      ),'[]'::jsonb),
      'chat_memories',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',m.id,'organization_id',m.organization_id,'session_id',m.session_id,
          'source_message_id',m.source_message_id,'memory_type',m.memory_type,
          'content',m.content,'embedding_model',m.embedding_model,'metadata',m.metadata,
          'created_at',m.created_at,'expires_at',m.expires_at
        ) order by m.created_at)
        from public.hercules_chat_memories m where m.user_id=v_user_id
      ),'[]'::jsonb),
      'chat_tool_calls',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',t.id,'session_id',t.session_id,'message_id',t.message_id,'call_id',t.call_id,
          'tool_name',t.tool_name,'arguments',t.arguments,'result',t.result,'status',t.status,
          'error_code',t.error_code,'error_message',t.error_message,
          'started_at',t.started_at,'completed_at',t.completed_at,'metadata',t.metadata
        ) order by t.started_at)
        from public.hercules_chat_tool_calls t where t.user_id=v_user_id
      ),'[]'::jsonb),
      'memberships',coalesce((
        select jsonb_agg(jsonb_build_object(
          'organization_id',m.organization_id,'role',m.role,'status',m.status,
          'created_at',m.created_at,'updated_at',m.updated_at
        ) order by m.created_at)
        from public.hercules_memberships m where m.user_id=v_user_id
      ),'[]'::jsonb),
      'usage',coalesce((
        select jsonb_agg(jsonb_build_object(
          'period',u.period,'ai_runs',u.ai_runs,'updated_at',u.updated_at
        ) order by u.period)
        from public.hercules_usage u where u.user_id=v_user_id
      ),'[]'::jsonb),
      'usage_events',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',e.id,'organization_id',e.organization_id,'metric',e.metric,'quantity',e.quantity,
          'unit',e.unit,'request_id',e.request_id,'metadata',e.metadata,
          'occurred_at',e.occurred_at,'created_at',e.created_at
        ) order by e.occurred_at)
        from public.hercules_usage_events e where e.user_id=v_user_id
      ),'[]'::jsonb),
      'billing',coalesce((
        select jsonb_agg(jsonb_build_object(
          'plan',b.plan,'status',b.status,'stripe_customer_id',b.stripe_customer_id,
          'stripe_subscription_id',b.stripe_subscription_id,
          'cancel_at_period_end',b.cancel_at_period_end,
          'current_period_end',b.current_period_end,'updated_at',b.updated_at
        ))
        from public.hercules_billing b where b.user_id=v_user_id
      ),'[]'::jsonb)
    ),
    'excluded_by_design',jsonb_build_array(
      'password hashes and authentication secrets',
      'session/refresh tokens',
      'service-role credentials',
      'other users data',
      'internal security secrets'
    ),
    'delivery_state','owner_review_required'
  );
end;
$$;

revoke all on function public.hercules_privacy_request_export(uuid) from public, anon, authenticated;
grant execute on function public.hercules_privacy_request_export(uuid) to service_role;

comment on function public.hercules_privacy_request_export(uuid) is
  'Generates a reviewed JSON export for one verified access/export request. Excludes authentication secrets and unrelated user data.';

create or replace function public.hercules_privacy_request_delete_user_scoped(
  p_public_reference uuid,
  p_execute boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.hercules_privacy_requests%rowtype;
  v_user_id uuid;
  v_before jsonb;
  v_deleted jsonb := '{}'::jsonb;
  v_count integer;
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
    return jsonb_build_object('ok',false,'error','requester_not_verified','reference',v_request.public_reference);
  end if;

  if v_request.category <> 'privacy_deletion' then
    return jsonb_build_object('ok',false,'error','deletion_not_applicable','reference',v_request.public_reference);
  end if;

  select u.id
  into v_user_id
  from auth.users u
  where lower(u.email)=lower(v_request.email)
  order by u.created_at asc
  limit 1;

  if v_user_id is null then
    return jsonb_build_object('ok',false,'error','subject_not_found','reference',v_request.public_reference);
  end if;

  v_before := jsonb_build_object(
    'hercules_projects',(select count(*) from public.hercules_projects where user_id=v_user_id),
    'hercules_sessions',(select count(*) from public.hercules_sessions where user_id=v_user_id),
    'hercules_chat_sessions',(select count(*) from public.hercules_chat_sessions where user_id=v_user_id),
    'hercules_chat_messages',(select count(*) from public.hercules_chat_messages where user_id=v_user_id),
    'hercules_chat_memories',(select count(*) from public.hercules_chat_memories where user_id=v_user_id),
    'hercules_chat_tool_calls',(select count(*) from public.hercules_chat_tool_calls where user_id=v_user_id)
  );

  if not p_execute then
    return jsonb_build_object(
      'ok',true,
      'mode','dry_run',
      'reference',v_request.public_reference,
      'subject_user_id',v_user_id,
      'request_status',v_request.status,
      'user_scoped_content',v_before,
      'review_before_deletion',jsonb_build_object(
        'hercules_memberships',(select count(*) from public.hercules_memberships where user_id=v_user_id),
        'hercules_usage',(select count(*) from public.hercules_usage where user_id=v_user_id),
        'hercules_usage_events',(select count(*) from public.hercules_usage_events where user_id=v_user_id),
        'hercules_billing',(select count(*) from public.hercules_billing where user_id=v_user_id)
      ),
      'protected_by_default',jsonb_build_array(
        'hercules_audit_log','hercules_security_events','hercules_release_attestations',
        'hercules_release_queue','hercules_release_rollouts','required_tax_accounting_legal_records'
      ),
      'executable',v_request.status='in_progress',
      'next_action','exact_owner_confirmation_required'
    );
  end if;

  if v_request.status <> 'in_progress' then
    return jsonb_build_object(
      'ok',false,
      'error','deletion_request_not_approved_for_execution',
      'reference',v_request.public_reference,
      'required_status','in_progress'
    );
  end if;

  delete from public.hercules_chat_tool_calls where user_id=v_user_id;
  get diagnostics v_count=row_count;
  v_deleted := v_deleted || jsonb_build_object('hercules_chat_tool_calls',v_count);

  delete from public.hercules_chat_memories where user_id=v_user_id;
  get diagnostics v_count=row_count;
  v_deleted := v_deleted || jsonb_build_object('hercules_chat_memories',v_count);

  delete from public.hercules_chat_messages where user_id=v_user_id;
  get diagnostics v_count=row_count;
  v_deleted := v_deleted || jsonb_build_object('hercules_chat_messages',v_count);

  delete from public.hercules_chat_sessions where user_id=v_user_id;
  get diagnostics v_count=row_count;
  v_deleted := v_deleted || jsonb_build_object('hercules_chat_sessions',v_count);

  delete from public.hercules_sessions where user_id=v_user_id;
  get diagnostics v_count=row_count;
  v_deleted := v_deleted || jsonb_build_object('hercules_sessions',v_count);

  delete from public.hercules_projects where user_id=v_user_id;
  get diagnostics v_count=row_count;
  v_deleted := v_deleted || jsonb_build_object('hercules_projects',v_count);

  update public.hercules_privacy_requests
  set
    status='completed',
    resolution=coalesce(resolution,'{}'::jsonb) || jsonb_build_object(
      'type','user_scoped_deletion',
      'executed_at',now(),
      'deleted',v_deleted,
      'protected_records_retained',true
    ),
    resolved_at=now(),
    updated_at=now()
  where public_reference=p_public_reference;

  return jsonb_build_object(
    'ok',true,
    'mode','executed',
    'reference',v_request.public_reference,
    'subject_user_id',v_user_id,
    'before',v_before,
    'deleted',v_deleted,
    'post_deletion_verification',jsonb_build_object(
      'hercules_projects',(select count(*) from public.hercules_projects where user_id=v_user_id),
      'hercules_sessions',(select count(*) from public.hercules_sessions where user_id=v_user_id),
      'hercules_chat_sessions',(select count(*) from public.hercules_chat_sessions where user_id=v_user_id),
      'hercules_chat_messages',(select count(*) from public.hercules_chat_messages where user_id=v_user_id),
      'hercules_chat_memories',(select count(*) from public.hercules_chat_memories where user_id=v_user_id),
      'hercules_chat_tool_calls',(select count(*) from public.hercules_chat_tool_calls where user_id=v_user_id)
    ),
    'review_before_deletion_retained',true,
    'protected_by_default',jsonb_build_array(
      'hercules_memberships','hercules_usage','hercules_usage_events','hercules_billing',
      'hercules_audit_log','hercules_security_events','hercules_release_attestations',
      'hercules_release_queue','hercules_release_rollouts','required_tax_accounting_legal_records'
    )
  );
end;
$$;

revoke all on function public.hercules_privacy_request_delete_user_scoped(uuid,boolean) from public, anon, authenticated;
grant execute on function public.hercules_privacy_request_delete_user_scoped(uuid,boolean) to service_role;

comment on function public.hercules_privacy_request_delete_user_scoped(uuid,boolean) is
  'Dry-run by default. When explicitly executed after verified owner approval, deletes only user-scoped Hercules content and preserves review/protected records.';
