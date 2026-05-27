ALTER TABLE campaign_sending_limits
    ADD COLUMN IF NOT EXISTS followup_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS followup_daily_limit INTEGER,
    ADD COLUMN IF NOT EXISTS followup_monthly_limit INTEGER,
    ADD COLUMN IF NOT EXISTS followup_delay_value INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS followup_delay_unit TEXT NOT NULL DEFAULT 'days';

ALTER TABLE campaign_sending_limits
    DROP CONSTRAINT IF EXISTS campaign_sending_limits_followup_daily_limit_check,
    DROP CONSTRAINT IF EXISTS campaign_sending_limits_followup_monthly_limit_check,
    DROP CONSTRAINT IF EXISTS campaign_sending_limits_followup_delay_value_check,
    DROP CONSTRAINT IF EXISTS campaign_sending_limits_followup_delay_unit_check,
    DROP CONSTRAINT IF EXISTS campaign_sending_limits_followup_monthly_gte_daily_check;

ALTER TABLE campaign_sending_limits
    ADD CONSTRAINT campaign_sending_limits_followup_daily_limit_check CHECK (
        followup_daily_limit IS NULL OR followup_daily_limit > 0
    ),
    ADD CONSTRAINT campaign_sending_limits_followup_monthly_limit_check CHECK (
        followup_monthly_limit IS NULL OR followup_monthly_limit > 0
    ),
    ADD CONSTRAINT campaign_sending_limits_followup_delay_value_check CHECK (
        followup_delay_value > 0
    ),
    ADD CONSTRAINT campaign_sending_limits_followup_delay_unit_check CHECK (
        followup_delay_unit IN ('hours', 'days')
    ),
    ADD CONSTRAINT campaign_sending_limits_followup_monthly_gte_daily_check CHECK (
        followup_daily_limit IS NULL
        OR followup_monthly_limit IS NULL
        OR followup_monthly_limit >= followup_daily_limit
    );

ALTER TABLE email_logs
    ADD COLUMN IF NOT EXISTS send_kind TEXT NOT NULL DEFAULT 'campaign';

ALTER TABLE email_logs
    DROP CONSTRAINT IF EXISTS email_logs_send_kind_check;

ALTER TABLE email_logs
    ADD CONSTRAINT email_logs_send_kind_check CHECK (
        send_kind IN ('campaign', 'followup')
    );

CREATE INDEX IF NOT EXISTS email_logs_campaign_send_kind_created_at_idx
    ON email_logs (campaign_id, send_kind, created_at DESC);
