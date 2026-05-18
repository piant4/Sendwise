CREATE TABLE IF NOT EXISTS campaign_sending_limits (
    campaign_id UUID PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
    period_email_limit INTEGER NOT NULL DEFAULT 1000,
    daily_email_limit INTEGER NOT NULL DEFAULT 50,
    period_started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT campaign_sending_limits_period_email_limit_check CHECK (period_email_limit > 0),
    CONSTRAINT campaign_sending_limits_daily_email_limit_check CHECK (daily_email_limit > 0)
);

ALTER TABLE campaign_sending_limits
    ADD COLUMN IF NOT EXISTS period_email_limit INTEGER NOT NULL DEFAULT 1000,
    ADD COLUMN IF NOT EXISTS daily_email_limit INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS period_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

INSERT INTO campaign_sending_limits (
    campaign_id,
    period_email_limit,
    daily_email_limit,
    period_started_at
)
SELECT
    campaigns.id,
    1000,
    50,
    earliest_logs.first_created_at
FROM campaigns
LEFT JOIN (
    SELECT
        campaign_id,
        MIN(created_at) AS first_created_at
    FROM email_logs
    WHERE campaign_id IS NOT NULL
        AND status <> 'simulated'
    GROUP BY campaign_id
) AS earliest_logs
    ON earliest_logs.campaign_id = campaigns.id
ON CONFLICT (campaign_id) DO NOTHING;
