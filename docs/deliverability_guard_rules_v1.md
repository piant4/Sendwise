# Deliverability Guard Rules V1

Date: 2026-05-23

This document merges the Sendwise deliverability study notes:

- Email Deliverability - Studi corretti per Sendwise
- Perche le mail finiscono nello spam?
- Claude ci dice - Email Deliverability: Guida Completa 2025-2026

It is a product and research source of truth for Deliverability Guard behavior. It is not a provider contract, legal promise, or guarantee of inbox placement.

## Interpretation Rules

- Official provider requirements are cited separately from Sendwise product policy.
- Sendwise thresholds are internal conservative policy. They may be stricter than provider minimums and may change as provider event data improves.
- Third-party benchmark data, tools, seed tests, and deliverability studies are informative only, not normative.
- Sendwise does not guarantee inbox placement. The product promise is to protect sender reputation and deliverability by blocking risky sends, surfacing risk, and enforcing conservative operating rules.

## Simple Explanation: Why Emails Go To Spam

Emails usually go to spam or get rejected because one or more trust signals fail.

Authentication missing:
- SPF, DKIM, or DMARC is missing, broken, or not aligned with the visible sender domain.
- The sending domain or IP does not match expected DNS identity signals.

Poor reputation:
- The domain, sending IP, provider account, or customer list has a history of complaints, bounces, spam traps, or erratic volume.
- A new or cold domain sends too much too quickly.

Risky formatting/content:
- The message looks deceptive, over-promotional, malformed, link-heavy, image-only, or inconsistent with previous sender behavior.
- The message hides sender identity, lacks a clear unsubscribe path for marketing mail, or uses suspicious URLs.

Negative engagement:
- Recipients mark mail as spam, delete without reading, ignore repeated messages, unsubscribe, or stop engaging.
- Low engagement is not always available as a reliable provider signal, but it should be treated as a risk indicator when event data exists.

Technical infrastructure:
- Reverse DNS/PTR, forward DNS, TLS, message formatting, provider webhook configuration, or suppression handling is incomplete.
- Provider events are missing or delayed, so Sendwise cannot safely calculate reputation or health metrics.

## Official Provider Requirements And Facts

These facts are authoritative for the named provider only. They should be checked again before changing runtime enforcement because provider policies evolve.

### Google/Gmail

Source: Google Workspace Admin Help, Email sender guidelines: <https://support.google.com/mail/answer/81126>

Official requirements represented in Sendwise:
- All senders to Gmail must authenticate with SPF or DKIM.
- Bulk senders must use SPF, DKIM, and DMARC.
- Sending IPs must have PTR/reverse DNS.
- TLS is required for transmitting email.
- Spam rates reported in Google Postmaster Tools should stay below 0.3%.
- Marketing and subscribed bulk messages must support one-click unsubscribe where applicable and include a visible unsubscribe link.

Sendwise interpretation:
- V1 should not claim Gmail inbox placement.
- V1 may block or warn before the 0.3% complaint boundary because Sendwise policy is deliberately conservative.
- Google Postmaster Tools data is provider-side telemetry; Sendwise should not invent it from local events.

### Yahoo

Source: Yahoo Sender Hub, Sender Best Practices: <https://senders.yahooinc.com/best-practices/>

Official requirements represented in Sendwise:
- All senders must authenticate with SPF or DKIM at minimum.
- Senders must keep spam complaint rates below 0.3%.
- Sending IPs must have valid forward and reverse DNS records.
- Bulk senders have stricter authentication and unsubscribe expectations.

Sendwise interpretation:
- Yahoo complaint-rate and CFL data should be treated as provider-specific. Sendwise local complaint counts are useful but are not the same as Yahoo's internal complaint-rate calculation.

### Microsoft/Outlook

Source: Microsoft Tech Community, Outlook high-volume sender requirements: <https://techcommunity.microsoft.com/blog/microsoftdefenderforoffice365blog/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730>

Official requirements represented in Sendwise:
- High-volume senders to Outlook consumer domains must meet SPF, DKIM, and DMARC requirements.
- Authentication failures can lead to rejection or filtering.

Sendwise interpretation:
- Microsoft sender health should be modeled separately when provider-specific bounce and complaint signals are available.

### Amazon SES

Source: Amazon SES sending review process FAQs: <https://docs.aws.amazon.com/ses/latest/dg/faqs-enforcement.html>

Official facts represented in Sendwise:
- SES monitors sent mail for malicious, unsolicited, or low-quality email.
- Bounce, complaint, and list quality can affect account review or suspension risk.

Sendwise interpretation:
- SES reputation protection requires fast suppression of hard bounces and complaints.
- SES account-review thresholds should not be restated as universal Sendwise limits unless Amazon publishes them for the relevant account context.

### Mailgun

Sources:
- Mailgun events: <https://documentation.mailgun.com/docs/mailgun/user-manual/events/events>
- Mailgun webhooks: <https://documentation.mailgun.com/docs/mailgun/user-manual/webhooks/webhooks>

Official facts represented in Sendwise:
- Mailgun events/webhooks can provide accepted, delivered, failed, opened, clicked, unsubscribed, and complained events.
- Open and click tracking depend on Mailgun tracking configuration and recipient/client behavior.
- Delivered means accepted by the recipient mail server; it does not prove inbox placement.

Sendwise interpretation:
- Provider events are the boundary for delivery analytics.
- Sendwise must not fabricate delivered, opened, clicked, complained, unsubscribed, or bounced metrics when provider events are absent.

## Sendwise Internal Conservative Policy

These are Sendwise policy rules, not official provider requirements.

### Complaint Policy

Complaint rate is calculated from provider complaint events over a campaign, domain, and rolling domain window when provider data exists.

- Warning: complaint rate >= 0.10%.
- Stop: complaint rate >= 0.30% or any sudden complaint cluster on a low-volume/new domain.
- Action: suppress complainers immediately, block further sends for the affected campaign/domain when stop threshold is reached, and require admin review before resuming.

### Hard Bounce Policy

Hard bounce rate is calculated from permanent failure/bounce provider events over campaign, domain, and rolling domain windows.

- Warning: hard bounce rate >= 2.00%.
- Stop: hard bounce rate >= 5.00% or repeated hard bounces from the same imported source/list segment.
- Action: suppress hard-bounced recipients, block sends to the affected list segment, and require list-quality review before resuming.

### Unsubscribe Policy

Unsubscribe rate is calculated from provider or listmonk unsubscribe events over delivered messages when delivered counts exist; otherwise it is shown as event count with incomplete denominator.

- Warning: unsubscribe rate >= 1.00%.
- Stop/review: unsubscribe rate >= 2.00% or a sharp spike after a single campaign.
- Action: honor unsubscribe immediately, suppress future sends, and flag content/audience mismatch.

### Suppression Automation

Suppress automatically:
- spam complaints
- hard bounces/permanent failures
- unsubscribes
- manually suppressed contacts

Do not automatically suppress on:
- soft bounce/temporary failure without repeat evidence
- open/click absence
- third-party seed-test result alone

### Contact Quality Score

Contact Quality Score is an internal recipient/list-quality score. Inputs may include:
- valid email syntax
- role-address or disposable-domain risk
- prior hard bounce or complaint history
- unsubscribe history
- duplicate imports
- engagement recency when provider data exists
- source/import confidence

V1 policy:
- Low-quality contacts should be blocked from sending.
- Medium-risk contacts should require admin review or smaller warmup batches.
- No contact should be marked healthy solely because it has no known negative events.

### Domain Health Score

Domain Health Score is an internal sending-identity score. Inputs may include:
- SPF/DKIM/DMARC readiness checks
- provider event availability
- complaint rate
- hard bounce rate
- unsubscribe rate
- recent volume compared with warmup allowance
- suppression velocity
- Mailgun/domain webhook health

V1 policy:
- Missing authentication evidence blocks controlled sends.
- Missing provider-event boundary limits dashboard claims.
- Healthy status requires both configuration readiness and recent low-risk event history.

### Campaign Risk Score

Campaign Risk Score combines:
- Contact Quality Score
- Domain Health Score
- campaign size and pacing
- content spam-linter results
- unsubscribe availability
- recipient source/list age
- recent complaint/bounce/unsubscribe history

V1 policy:
- High-risk campaigns are blocked before dispatch.
- Medium-risk campaigns require review and reduced send volume.
- Low-risk campaigns may proceed only within configured campaign limits and warmup allowance.

### Content Spam Linter

The linter should flag risk, not promise inbox placement.

Signals:
- missing visible unsubscribe copy for marketing/bulk mail
- misleading subject/from mismatch
- excessive urgency, deceptive claims, or all-caps promotional language
- image-only body or very low text-to-image ratio
- too many links or suspicious/mismatched link domains
- broken personalization placeholders
- raw template variables left in final content
- missing physical sender/contact information when required by policy or law

V1 policy:
- Critical linter failures block send.
- Warnings require admin review but should not be described as provider-certified spam predictions.

### Warmup And Throttling

Warmup is an internal throttle policy for new/cold domains or domains with insufficient recent healthy event history.

Default conservative schedule:

| Warmup day | Maximum recipients per domain per day |
| --- | ---: |
| 1 | 25 |
| 2 | 50 |
| 3 | 75 |
| 4 | 100 |
| 5 | 150 |
| 6 | 200 |
| 7 | 300 |
| 8-14 | Increase by at most 25% per healthy day |

Rules:
- Do not increase volume after complaint, hard-bounce, unsubscribe, or webhook-health warnings.
- Reset or pause warmup after a stop-level complaint or bounce event.
- Attribute warmup by sending domain, not only by global provider account.
- Never present warmup as a guarantee of inbox placement.

## Provider Event Requirements

Sendwise deliverability analytics depend on provider events.

Required event classes:
- accepted/queued: provider accepted the request or queued message
- delivered: recipient server accepted the message
- bounced/failed: temporary or permanent delivery failure
- complained: recipient or feedback loop marked spam complaint
- unsubscribed: recipient unsubscribed
- opened: open tracking event when enabled and available
- clicked: click tracking event when enabled and available

Product rules:
- Delivered is not inboxed.
- Accepted is not delivered.
- Open/click data can be incomplete or privacy-filtered.
- Complaint and unsubscribe events must update suppression quickly.
- Dashboards must show unavailable/incomplete states instead of invented rates.

## Dashboard Deliverability Metrics

V1 dashboard metrics should be provider-event-backed or explicitly marked unavailable.

Recommended metrics:
- accepted count
- delivered count
- permanent failed/hard bounce count
- temporary failed/soft bounce count
- complaint count and rate when denominator exists
- unsubscribe count and rate when denominator exists
- unique opens and clicks when tracking is enabled
- blocked sends by Guard reason
- domain warmup allowance and used volume
- domain health state: healthy, watch, paused, blocked, unknown
- provider-event freshness and webhook health

Do not show:
- inbox placement percentage unless sourced from a named provider/tool and labeled as directional
- fake delivered/open/click counts
- provider-specific rates when the relevant provider data is missing
- official-looking benchmark comparisons from third-party studies

## Deliverability Guard Roadmap

### Already Implemented

- Backend-owned campaign preparation and send gating.
- Controlled Listmonk to Mailgun sending path.
- Listmonk campaign payload composition no longer uses Sendwise custom one-click unsubscribe headers; native Listmonk one-click unsubscribe is the verified V1 path through public HTTPS `subscription.mailerpro.it` headers, with visible Sendwise body unsubscribe retained.
- Mailgun correlation for Listmonk SMTP sends uses static campaign/client variables plus tenant-validated recipient fallback, not templated recipient IDs in custom headers.
- Native Listmonk one-click reconciliation is verified exact-once for the controlled campaign path: a first no-dispatch reconciliation applied one Sendwise suppression and replay applied no second suppression.
- Domain-scoped warmup attribution.
- Mailgun webhook analytics boundary.
- Suppression and unsubscribe handling boundaries.
- Client dashboard metrics constrained by backend/provider data availability.
- Guard blocking concepts for risky sends and readiness failures.
- V1 runtime closure has verified correlated Mailgun `accepted` and `delivered` events, native one-click headers, RFC 8058 HTTP 200 unsubscribe handling, Listmonk membership becoming `unsubscribed`, and Sendwise suppression reconciliation without additional sends, negative provider events, schema changes, secret exposure, or public Listmonk API/admin exposure.
- Staging Listmonk is configured with container hostname `listmonk.send.mailerpro.it` only to avoid localhost-style generated `Message-Id` values in outbound SMTP messages; controlled delivery verified the delivered `Message-Id` no longer used `localhost.localdomain` and used `listmonk.send.mailerpro.it`, while native List-Unsubscribe HTTPS, One-Click, DKIM, and Mailgun accepted/delivered correlation remained valid.
- Template readiness blocks unresolved mandatory brand identity and required CTA URL targets before dispatch: runtime no-send QA for campaign `f0aa4ba6-1a2e-4231-9e57-75bf50959f60` used authenticated admin `POST /admin/campaigns/{campaign_id}/review`. The review route was confirmed as no-dispatch for this QA and changed only review/readiness state, creating no `email_logs`, no `provider_events`, and no `listmonk_mappings`.
- Blank mandatory brand identity returned HTTP 200 with `allowed_to_send=false`, `content_ready=false`, `review_ready=false`, and `blocking_errors` containing `template_missing_company_name`.
- Blank CTA URL after setting a valid `company_name` returned HTTP 200 with `blocking_errors` containing `template_empty_cta_url`; `template_missing_company_name` was absent, and post-review counts remained `email_logs = 0`, `provider_events = 0`, and `listmonk_mappings = 0`.
- Valid mandatory brand identity after setting a valid `company_name` and valid `website_url`, while leaving optional logo/social fields absent, returned HTTP 200 with `content_ready=true`, `review_ready=false` only because the QA campaign intentionally had no contacts, and `blocking_errors` containing only `Campaign has no associated contacts.`; `template_missing_company_name` and `template_empty_cta_url` were absent, and post-review counts remained `email_logs = 0`, `provider_events = 0`, and `listmonk_mappings = 0`.
- Brand values must be configured through the supported admin client Brand email flow that persists `clients.metadata.email_brand`; manual database edits are not a valid product path before branded campaign review/send.
- No real send, unsubscribe, reconciliation, provider event, schema/migration, Listmonk configuration, Mailgun configuration, Docker, Caddy, DNS, or `.env` change occurred during the QA review verification.

### Next

- Save this document as the deliverability policy source of truth.
- Convert the policy into explicit Guard reason codes and admin-facing copy.
- Add domain-health state transitions based on authentication readiness, warmup allowance, and provider events.
- Add provider-event freshness checks before showing delivery analytics.
- Add campaign risk scoring for list quality, content lint, and recent domain health.
- Add admin-visible remediation steps for blocked sends.

### V2

- Provider-specific health panels for Gmail, Yahoo, Microsoft, SES, and Mailgun where data exists.
- Automated suppression audits and list-import quarantine for risky sources.
- More granular warmup schedules by domain age, volume history, and event quality.
- Content Spam Linter with structured findings and admin overrides.
- Contact Quality Score and Domain Health Score stored as explainable derived state.
- Complaint/bounce anomaly detection for small-volume campaigns.

### V3

- Inbox placement diagnostics from explicitly labeled external tools, if integrated.
- DMARC aggregate-report ingestion for provider/domain alignment analysis.
- Automated deliverability playbooks for recovery after complaint or bounce spikes.
- Multi-provider/domain routing recommendations constrained by policy and compliance.
- Longitudinal reputation trend analysis across campaigns and domains.

## Product Promise

Sendwise should never promise guaranteed inbox placement.

The correct promise:

> Sendwise protects reputation and deliverability by blocking risky sends, enforcing conservative warmup and suppression policy, and showing provider-backed delivery signals when available.

## Sources And Confidence

Official provider and RFC sources:
- Highest confidence for the requirement they define.
- Use as authoritative when implementing authentication, DNS, unsubscribe, complaint, and message-format requirements.
- Recheck before enforcement changes because provider policies can change.

Provider docs:
- Authoritative for that provider's event names, webhook behavior, dashboard semantics, account review language, and operational constraints.
- Do not generalize one provider's threshold to all providers unless Sendwise explicitly adopts it as internal policy.

Third-party studies, tools, seed tests, and benchmarks:
- Directional only.
- Useful for product heuristics, copy, and prioritization.
- Not official requirements and not proof of inbox placement.

Sendwise internal policy:
- Authoritative for Sendwise Guard behavior.
- Conservative by design.
- Must remain clearly labeled as product policy rather than provider mandate.
