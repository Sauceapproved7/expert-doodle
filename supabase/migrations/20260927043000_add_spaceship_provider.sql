-- Add Spaceship as an explicit external provider for domain/DNS operations.
alter table public.hercules_provider_connections
  drop constraint if exists hercules_provider_connections_provider_check;

alter table public.hercules_provider_connections
  add constraint hercules_provider_connections_provider_check
  check (provider = any (array[
    'shopify'::text,
    'stripe'::text,
    'woocommerce'::text,
    'wix'::text,
    'etsy'::text,
    'bigcommerce'::text,
    'amazon_sp'::text,
    'google_drive'::text,
    'github_forge'::text,
    'spaceship'::text
  ]));
