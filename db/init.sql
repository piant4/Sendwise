-- Milestone 0 schema stubs for Email AI Platform V1.
-- This is intentionally minimal and not production-complete.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

SELECT 'CREATE DATABASE listmonk'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'listmonk')\gexec

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    personal_name TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    email_limit_per_campaign INTEGER,
    max_campaigns INTEGER,
    monthly_email_limit INTEGER,
    daily_email_limit INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    clerk_user_id TEXT UNIQUE,
    clerk_invitation_id TEXT,
    portal_slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'invited',
    invitation_status TEXT,
    invited_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT client_access_status_check CHECK (
        status IN ('invited', 'active', 'suspended', 'archived')
    ),
    CONSTRAINT client_access_invitation_status_check CHECK (
        invitation_status IS NULL
        OR invitation_status IN ('pending', 'accepted', 'revoked', 'expired')
    ),
    CONSTRAINT client_access_portal_slug_check CHECK (
        char_length(portal_slug) >= 32
        AND portal_slug ~ '^[A-Za-z0-9]+$'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS client_access_active_email_idx
    ON client_access (lower(email))
    WHERE status IN ('invited', 'active');

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    subject TEXT,
    campaign_slot_id UUID,
    preview_text TEXT,
    body_html TEXT,
    body_text TEXT,
    content_ready BOOLEAN NOT NULL DEFAULT FALSE,
    contacts_ready BOOLEAN NOT NULL DEFAULT FALSE,
    review_ready BOOLEAN NOT NULL DEFAULT FALSE,
    current_step TEXT NOT NULL DEFAULT 'setup',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT campaigns_current_step_check CHECK (
        current_step IN ('setup', 'content', 'recipients', 'review', 'send')
    )
);

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

CREATE INDEX IF NOT EXISTS campaign_slots_client_id_idx
    ON campaign_slots (client_id);

CREATE INDEX IF NOT EXISTS campaign_slots_assigned_campaign_id_idx
    ON campaign_slots (assigned_campaign_id);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_slots_assigned_campaign_id_unique_idx
    ON campaign_slots (assigned_campaign_id)
    WHERE assigned_campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaigns_campaign_slot_id_idx
    ON campaigns (campaign_slot_id);

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

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    contact_id UUID NOT NULL REFERENCES contacts(id),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    campaign_id UUID REFERENCES campaigns(id),
    contact_id UUID REFERENCES contacts(id),
    status TEXT NOT NULL,
    provider_message_id TEXT,
    body TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    usage_type TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppression_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id),
    email TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id),
    campaign_id UUID REFERENCES campaigns(id),
    contact_id UUID REFERENCES contacts(id),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blocked_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    campaign_id UUID REFERENCES campaigns(id),
    contact_id UUID REFERENCES contacts(id),
    reason TEXT NOT NULL,
    decision TEXT NOT NULL DEFAULT 'blocked',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listmonk_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    listmonk_type TEXT NOT NULL,
    listmonk_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS listmonk_mappings_business_entity_idx
    ON listmonk_mappings (client_id, entity_type, entity_id, listmonk_type);
