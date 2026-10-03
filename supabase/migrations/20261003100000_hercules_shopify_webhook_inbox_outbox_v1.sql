create table if not exists public.hercules_shopify_webhook_inbox_v1 (
  webhook_id uuid primary key,
  event_id uuid,
  shop_domain text not null,
  topic text not null,
  api_version text not null,
  triggered_at timestamptz,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  payload_json jsonb not null,
  received_at timestamptz not null default now(),
  state text not null default 'queued' check (state in ('queued','processing','done','failed')),
  last_error text
);

create table if not exists public.hercules_shopify_webhook_outbox_v1 (
  webhook_id uuid primary key references public.hercules_shopify_webhook_inbox_v1(webhook_id) on delete cascade,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  state text not null default 'pending' check (state in ('pending','claimed','dispatched','failed'))
);

create table if not exists private.hercules_shopify_webhook_ingest_config_v1 (
  singleton boolean primary key default true check (singleton),
  ingest_token_sha256 text not null check (ingest_token_sha256 ~ '^[a-f0-9]{64}$'),
  updated_at timestamptz not null default now()
);

alter table public.hercules_shopify_webhook_inbox_v1 enable row level security;
alter table public.hercules_shopify_webhook_outbox_v1 enable row level security;

create or replace function public.hercules_shopify_webhook_ingest_v1(
  p_ingest_token text,p_webhook_id uuid,p_event_id uuid,p_shop_domain text,p_topic text,
  p_api_version text,p_triggered_at timestamptz,p_payload_sha256 text,p_payload_json jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,private,extensions,pg_temp
as $$
declare v_expected text;v_inserted integer:=0;
begin
  select ingest_token_sha256 into v_expected from private.hercules_shopify_webhook_ingest_config_v1 where singleton=true;
  if v_expected is null then raise exception 'shopify_ingest_not_configured'; end if;
  if encode(extensions.digest(p_ingest_token,'sha256'),'hex')<>v_expected then raise exception 'shopify_ingest_unauthorized'; end if;
  if lower(trim(p_shop_domain))<>'sauceapproved-2.myshopify.com' then raise exception 'shop_not_allowed'; end if;
  if lower(trim(p_topic)) not in ('orders/paid','app/uninstalled','domains/create','domains/update','domains/destroy') then raise exception 'topic_not_allowed'; end if;
  insert into public.hercules_shopify_webhook_inbox_v1(webhook_id,event_id,shop_domain,topic,api_version,triggered_at,payload_sha256,payload_json,state)
  values(p_webhook_id,p_event_id,lower(trim(p_shop_domain)),lower(trim(p_topic)),p_api_version,p_triggered_at,lower(p_payload_sha256),p_payload_json,'queued')
  on conflict (webhook_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then return jsonb_build_object('accepted',false,'duplicate',true,'webhook_id',p_webhook_id); end if;
  insert into public.hercules_shopify_webhook_outbox_v1(webhook_id,state) values(p_webhook_id,'pending');
  return jsonb_build_object('accepted',true,'duplicate',false,'webhook_id',p_webhook_id);
end $$;

revoke all on function public.hercules_shopify_webhook_ingest_v1(text,uuid,uuid,text,text,text,timestamptz,text,jsonb) from public;
grant execute on function public.hercules_shopify_webhook_ingest_v1(text,uuid,uuid,text,text,text,timestamptz,text,jsonb) to anon,authenticated,service_role;
