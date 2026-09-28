-- The controlled pilot front door is a critical public route. Existing ops
-- monitoring verifies JSON reachability; functional contract checks remain
-- separately tracked in DA-32.
INSERT INTO public.hercules_service_registry
  (service_slug, display_name, health_path, enabled, critical, metadata)
VALUES
  ('hercules-launch', 'Hercules Founding Pilot Launch',
   '/functions/v1/hercules-launch?health=1', true, true,
   jsonb_build_object('expected', 'json-ok', 'scope', 'public-launch-health'))
ON CONFLICT (service_slug) DO UPDATE
SET display_name = EXCLUDED.display_name,
    health_path = EXCLUDED.health_path,
    enabled = true,
    critical = true,
    metadata = coalesce(public.hercules_service_registry.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = now();
