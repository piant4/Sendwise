CREATE TABLE IF NOT EXISTS campaign_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    label TEXT NOT NULL,
    max_emails INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    assigned_campaign_id UUID REFERENCES campaigns(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT campaign_slots_max_emails_check CHECK (max_emails >= 0),
    CONSTRAINT campaign_slots_status_check CHECK (
        status IN ('available', 'assigned', 'used', 'archived')
    )
);

ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS campaign_slot_id UUID,
    ADD COLUMN IF NOT EXISTS preview_text TEXT,
    ADD COLUMN IF NOT EXISTS body_html TEXT,
    ADD COLUMN IF NOT EXISTS body_text TEXT,
    ADD COLUMN IF NOT EXISTS content_ready BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS contacts_ready BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS review_ready BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS current_step TEXT NOT NULL DEFAULT 'setup';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'campaigns_current_step_check'
    ) THEN
        ALTER TABLE campaigns
            ADD CONSTRAINT campaigns_current_step_check CHECK (
                current_step IN ('setup', 'content', 'recipients', 'review', 'send')
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'campaigns_campaign_slot_id_fkey'
    ) THEN
        ALTER TABLE campaigns
            ADD CONSTRAINT campaigns_campaign_slot_id_fkey
            FOREIGN KEY (campaign_slot_id)
            REFERENCES campaign_slots(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS campaign_slots_client_id_idx
    ON campaign_slots (client_id);

CREATE INDEX IF NOT EXISTS campaign_slots_assigned_campaign_id_idx
    ON campaign_slots (assigned_campaign_id);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_slots_assigned_campaign_id_unique_idx
    ON campaign_slots (assigned_campaign_id)
    WHERE assigned_campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaigns_campaign_slot_id_idx
    ON campaigns (campaign_slot_id);
