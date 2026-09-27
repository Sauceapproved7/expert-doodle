create or replace view public.hercules_organic_acquisition_funnel_v1
with (security_invoker = true)
as
select
  date_trunc('day', occurred_at) as day,
  coalesce(nullif(properties->>'source',''), 'direct') as source,
  coalesce(nullif(properties->>'medium',''), 'organic') as medium,
  coalesce(nullif(properties->>'campaign',''), 'founding-pilot-organic-v1') as campaign,
  coalesce(nullif(properties->>'content',''), 'unspecified') as content,
  count(*) filter (where event_name = 'landing_view')::bigint as landing_views,
  count(*) filter (where event_name = 'cta_open_product')::bigint as product_open_ctas,
  count(*) filter (where event_name = 'proof_demo_started')::bigint as proof_demo_starts,
  count(*) filter (where event_name = 'pilot_request')::bigint as pilot_requests,
  count(*) filter (where event_name = 'first_verified_useful_action')::bigint as first_verified_useful_actions,
  count(distinct nullif(properties->>'attribution_id',''))::bigint as attributed_visitors
from public.marketing_events
where event_source = 'hercules-launch'
group by 1,2,3,4,5;

comment on view public.hercules_organic_acquisition_funnel_v1 is
  'Protected aggregate acquisition funnel for Hercules organic distribution. Contains no raw contact fields.';

revoke all on public.hercules_organic_acquisition_funnel_v1 from public;
revoke all on public.hercules_organic_acquisition_funnel_v1 from anon, authenticated;
grant select on public.hercules_organic_acquisition_funnel_v1 to service_role;
