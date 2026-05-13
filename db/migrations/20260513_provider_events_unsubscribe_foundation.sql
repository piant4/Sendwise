ALTER TABLE provider_events
    ADD COLUMN IF NOT EXISTS email_log_id UUID REFERENCES email_logs(id),
    ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'webhook',
    ADD COLUMN IF NOT EXISTS provider_event_id TEXT,
    ADD COLUMN IF NOT EXISTS event_key TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS provider_events_event_key_idx
    ON provider_events (event_key);

CREATE UNIQUE INDEX IF NOT EXISTS provider_events_provider_event_id_idx
    ON provider_events (provider, provider_event_id)
    WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS provider_events_campaign_idx
    ON provider_events (campaign_id, event_type);

CREATE INDEX IF NOT EXISTS provider_events_contact_idx
    ON provider_events (contact_id, event_type);

CREATE UNIQUE INDEX IF NOT EXISTS suppression_list_client_email_reason_idx
    ON suppression_list ((COALESCE(client_id::text, '')), lower(email), reason);
