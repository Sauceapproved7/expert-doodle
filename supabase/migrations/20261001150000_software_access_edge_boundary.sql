-- Retire direct browser execution of the privileged software-access RPC.
-- The public request path is now hercules-launch -> service_role -> constrained RPC.
revoke execute on function public.hercules_request_software_access(text,text,text,text,text,text,text,text,jsonb) from anon, authenticated;
grant execute on function public.hercules_request_software_access(text,text,text,text,text,text,text,text,jsonb) to service_role;
