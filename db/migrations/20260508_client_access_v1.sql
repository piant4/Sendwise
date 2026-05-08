ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS personal_name TEXT,
    ADD COLUMN IF NOT EXISTS company_name TEXT,
    ADD COLUMN IF NOT EXISTS email_limit_per_campaign INTEGER,
    ADD COLUMN IF NOT EXISTS max_campaigns INTEGER,
    ADD COLUMN IF NOT EXISTS monthly_email_limit INTEGER,
    ADD COLUMN IF NOT EXISTS daily_email_limit INTEGER;

UPDATE clients
SET
    email = COALESCE(email, CONCAT(id::text, '@sendwise.invalid')),
    company_name = COALESCE(company_name, NULLIF(name, ''))
WHERE email IS NULL;

ALTER TABLE clients
    ALTER COLUMN email SET NOT NULL;

ALTER TABLE clients
    ALTER COLUMN status SET DEFAULT 'active';

DROP TABLE IF EXISTS client_users;

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

CREATE UNIQUE INDEX IF NOT EXISTS clients_email_idx ON clients (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS client_access_active_email_idx
    ON client_access (lower(email))
    WHERE status IN ('invited', 'active');
