-- DA-32 follow-up: classify the mobile web application by its actual HTML health surface.
UPDATE public.hercules_service_registry
SET metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'expected','html-200',
      'verification','functional'
    ),
    updated_at=now()
WHERE service_slug='hercules-free-cloud-app';
