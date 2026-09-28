-- Harden Studio/Ads checkout diagnostics.
revoke all on function public.hercules_software_checkout_readiness(text) from public, anon, authenticated;
revoke all on function public.hercules_software_checkout_dry_run(text,text) from public, anon, authenticated;

grant execute on function public.hercules_software_checkout_readiness(text) to service_role;
grant execute on function public.hercules_software_checkout_dry_run(text,text) to service_role;

-- Owner approval remains an authenticated, owner-membership-checked surface.
revoke all on function public.hercules_software_owner_approve(text,text,text) from public, anon;
grant execute on function public.hercules_software_owner_approve(text,text,text) to authenticated;
