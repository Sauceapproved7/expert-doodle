-- DA-32: promote Hercules monitoring from reachability-only evidence to
-- explicit public, authenticated-functional, and freshness contracts.
WITH desired(service_slug,display_name,health_path,critical,metadata) AS (
  VALUES
    (
      'hercules-launch',
      'Hercules Founding Pilot Launch',
      '/functions/v1/hercules-launch?health=1',
      true,
      jsonb_build_object(
        'expected','public-launch-contract',
        'scope','public-launch-health',
        'verification','functional'
      )
    ),
    (
      'hercules-launch-page',
      'Hercules Founding Pilot Public Page',
      '/functions/v1/hercules-launch',
      true,
      jsonb_build_object(
        'expected','launch-page-contract',
        'scope','public-launch-page',
        'verification','functional'
      )
    ),
    (
      'hercules-devbrain-fabric',
      'Hercules DevBrain Fabric',
      '/functions/v1/hercules-devbrain-fabric',
      true,
      jsonb_build_object(
        'expected','devbrain-freshness',
        'scope','launch-evidence',
        'verification','functional+freshness',
        'max_age_seconds',86400
      )
    ),
    (
      'hercules-chat',
      'Hercules Chat',
      '/functions/v1/hercules-chat',
      true,
      jsonb_build_object(
        'expected','internal-json-health',
        'scope','authenticated-customer-path',
        'verification','authenticated-functional',
        'internal_key_purpose','ops-monitor'
      )
    ),
    (
      'hercules-revenue-rescue',
      'Hercules Revenue Rescue',
      '/functions/v1/hercules-revenue-rescue',
      true,
      jsonb_build_object(
        'expected','internal-json-health',
        'scope','authenticated-customer-path',
        'verification','authenticated-functional',
        'internal_key_purpose','ops-monitor'
      )
    )
)
INSERT INTO public.hercules_service_registry
  (service_slug,display_name,health_path,enabled,critical,metadata)
SELECT service_slug,display_name,health_path,true,critical,metadata
FROM desired
ON CONFLICT (service_slug) DO UPDATE
SET display_name=EXCLUDED.display_name,
    health_path=EXCLUDED.health_path,
    enabled=true,
    critical=EXCLUDED.critical,
    metadata=coalesce(public.hercules_service_registry.metadata,'{}'::jsonb)||EXCLUDED.metadata,
    updated_at=now();
