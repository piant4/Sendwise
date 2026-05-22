ALTER TABLE email_logs
    ADD COLUMN IF NOT EXISTS sending_domain TEXT;

ALTER TABLE blocked_sends
    ADD COLUMN IF NOT EXISTS sending_domain TEXT;

CREATE INDEX IF NOT EXISTS email_logs_sending_domain_created_at_idx
    ON email_logs (sending_domain, created_at);

CREATE INDEX IF NOT EXISTS blocked_sends_sending_domain_created_at_idx
    ON blocked_sends (sending_domain, created_at);
