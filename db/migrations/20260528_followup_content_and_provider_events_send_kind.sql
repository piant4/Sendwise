ALTER TABLE campaign_sending_limits
    ADD COLUMN IF NOT EXISTS followup_subject TEXT,
    ADD COLUMN IF NOT EXISTS followup_body_html TEXT,
    ADD COLUMN IF NOT EXISTS followup_body_text TEXT;

ALTER TABLE provider_events
    ADD COLUMN IF NOT EXISTS send_kind TEXT NOT NULL DEFAULT 'campaign';

ALTER TABLE provider_events
    DROP CONSTRAINT IF EXISTS provider_events_send_kind_check;

ALTER TABLE provider_events
    ADD CONSTRAINT provider_events_send_kind_check CHECK (
        send_kind IN ('campaign', 'followup')
    );

DROP INDEX IF EXISTS provider_events_campaign_idx;

CREATE INDEX IF NOT EXISTS provider_events_campaign_send_kind_idx
    ON provider_events (campaign_id, send_kind, event_type);
