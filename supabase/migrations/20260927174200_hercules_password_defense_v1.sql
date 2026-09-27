create table if not exists private.hercules_password_screening_tickets (
  ticket_id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('signup','change_password')),
  email text,
  user_id uuid,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint hercules_password_screening_ticket_target check (
    (purpose='signup' and email is not null and user_id is null)
    or
    (purpose='change_password' and user_id is not null)
  )
);

alter table private.hercules_password_screening_tickets enable row level security;
revoke all on table private.hercules_password_screening_tickets from public, anon, authenticated;

create or replace function public.hercules_password_screening_issue(
  p_purpose text,
  p_email text default null,
  p_user_id uuid default null,
  p_ttl_seconds integer default 120
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket uuid;
  v_ttl integer := greatest(30, least(coalesce(p_ttl_seconds,120), 300));
begin
  if p_purpose not in ('signup','change_password') then
    raise exception 'invalid_password_screening_purpose';
  end if;
  if p_purpose='signup' and (p_email is null or btrim(p_email)='') then
    raise exception 'signup_email_required';
  end if;
  if p_purpose='change_password' and p_user_id is null then
    raise exception 'password_change_user_required';
  end if;

  delete from private.hercules_password_screening_tickets
  where expires_at < now() - interval '1 day';

  insert into private.hercules_password_screening_tickets(purpose,email,user_id,expires_at)
  values (
    p_purpose,
    case when p_email is null then null else lower(btrim(p_email)) end,
    p_user_id,
    now() + make_interval(secs => v_ttl)
  )
  returning ticket_id into v_ticket;

  return v_ticket;
end;
$$;

revoke all on function public.hercules_password_screening_issue(text,text,uuid,integer) from public, anon, authenticated;
grant execute on function public.hercules_password_screening_issue(text,text,uuid,integer) to service_role;

create or replace function private.hercules_enforce_password_screening()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket_text text;
  v_ticket uuid;
  v_match uuid;
begin
  if tg_op='UPDATE'
     and new.encrypted_password is distinct from old.encrypted_password
     and new.last_sign_in_at is distinct from old.last_sign_in_at then
    return new;
  end if;

  if tg_op='INSERT' and coalesce(new.encrypted_password,'') <> '' then
    v_ticket_text := coalesce(new.raw_user_meta_data,'{}'::jsonb)->>'hercules_password_screening_ticket';
    begin
      v_ticket := v_ticket_text::uuid;
    exception when others then
      raise exception 'hercules_password_screening_required';
    end;

    update private.hercules_password_screening_tickets
       set consumed_at=now()
     where ticket_id=v_ticket
       and purpose='signup'
       and consumed_at is null
       and expires_at>now()
       and email=lower(coalesce(new.email,''))
    returning ticket_id into v_match;

    if v_match is null then
      raise exception 'hercules_password_screening_required';
    end if;

    new.raw_user_meta_data := coalesce(new.raw_user_meta_data,'{}'::jsonb) - 'hercules_password_screening_ticket';
  elsif tg_op='UPDATE' and new.encrypted_password is distinct from old.encrypted_password then
    v_ticket_text := coalesce(new.raw_user_meta_data,'{}'::jsonb)->>'hercules_password_screening_ticket';
    begin
      v_ticket := v_ticket_text::uuid;
    exception when others then
      raise exception 'hercules_password_screening_required';
    end;

    update private.hercules_password_screening_tickets
       set consumed_at=now()
     where ticket_id=v_ticket
       and purpose='change_password'
       and consumed_at is null
       and expires_at>now()
       and user_id=new.id
    returning ticket_id into v_match;

    if v_match is null then
      raise exception 'hercules_password_screening_required';
    end if;

    new.raw_user_meta_data := coalesce(new.raw_user_meta_data,'{}'::jsonb) - 'hercules_password_screening_ticket';
  end if;

  return new;
end;
$$;

revoke all on function private.hercules_enforce_password_screening() from public, anon, authenticated;

drop trigger if exists hercules_password_screening_guard on auth.users;
create trigger hercules_password_screening_guard
before insert or update of encrypted_password on auth.users
for each row execute function private.hercules_enforce_password_screening();
