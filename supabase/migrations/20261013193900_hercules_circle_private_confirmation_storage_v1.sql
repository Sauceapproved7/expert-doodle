-- Hercules first-party confirmation-challenge storage. DORMANT until a
-- separately verified owned mail sender is available. Never expose bearer
-- credentials or subscriber emails in static/front-end clients.
BEGIN;
CREATE TABLE IF NOT EXISTS public.hercules_circle_confirmation_challenges (
 email text PRIMARY KEY REFERENCES public.hercules_cloud_founders(email)
  ON DELETE CASCADE,
 token_digest text NOT NULL UNIQUE CHECK (token_digest ~ '^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','sent','confirmed','revoked')),
 issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 sent_at timestamptz,
 confirmed_at timestamptz,
 CONSTRAINT confirmation_expiration_bounded
  CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '24 hours'),
 CONSTRAINT confirmation_sent_shape
  CHECK ((status = 'reserved' AND sent_at IS NULL AND confirmed_at IS NULL)
    OR (status = 'sent' AND sent_at IS NOT NULL AND confirmed_at IS NULL)
    OR (status = 'confirmed' AND sent_at IS NOT NULL AND confirmed_at IS NOT NULL)
    OR (status = 'revoked' AND confirmed_at IS NULL))
);
ALTER TABLE public.hercules_circle_confirmation_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hercules_circle_confirmation_challenges FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.hercules_circle_confirmation_challenges TO service_role;
-- No policy for anon/authenticated. A server-side service-role bridge is required
-- and must never appear in any JS/CSS/HTML delivered to visitors.
COMMENT ON TABLE public.hercules_circle_confirmation_challenges
IS 'Held one-time hashed challenges for explicit-consent Founding Circle subscribers. No verified mail sender or active public RPC.';
DO $verify$
BEGIN
 IF has_table_privilege('anon','public.hercules_circle_confirmation_challenges','SELECT')
 OR has_table_privilege('authenticated','public.hercules_circle_confirmation_challenges','SELECT')
 OR has_table_privilege('anon','public.hercules_circle_confirmation_challenges','INSERT')
 OR has_table_privilege('authenticated','public.hercules_circle_confirmation_challenges','UPDATE')
 THEN RAISE EXCEPTION 'hercules_circle_private_challenges_exposed'; END IF;
END
$verify$;
COMMIT;
