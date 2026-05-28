CREATE TABLE IF NOT EXISTS sending_domain_warmup_state (
    sending_domain TEXT PRIMARY KEY,
    current_stage INTEGER NOT NULL,
    stage_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    advancement_mode TEXT NOT NULL DEFAULT 'manual_review_required',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sending_domain_warmup_state
    DROP CONSTRAINT IF EXISTS sending_domain_warmup_state_stage_check;

ALTER TABLE sending_domain_warmup_state
    ADD CONSTRAINT sending_domain_warmup_state_stage_check CHECK (
        current_stage BETWEEN 1 AND 5
    );

ALTER TABLE sending_domain_warmup_state
    DROP CONSTRAINT IF EXISTS sending_domain_warmup_state_advancement_mode_check;

ALTER TABLE sending_domain_warmup_state
    ADD CONSTRAINT sending_domain_warmup_state_advancement_mode_check CHECK (
        advancement_mode IN ('manual_review_required')
    );

INSERT INTO sending_domain_warmup_state (
    sending_domain,
    current_stage,
    stage_started_at,
    advancement_mode
)
VALUES (
    'send.mailerpro.it',
    1,
    NOW(),
    'manual_review_required'
)
ON CONFLICT (sending_domain) DO NOTHING;
