#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: SES_VALIDATION_RECIPIENT=<single-recipient> bash scripts/prepare_ses_validation_target.sh"
  echo "   or: bash scripts/prepare_ses_validation_target.sh <single-recipient>"
}

recipient="${1:-${SES_VALIDATION_RECIPIENT:-${REAL_SEND_ALLOWED_RECIPIENTS:-}}}"

if [ "${2:-}" != "" ]; then
  echo "FAIL exactly one recipient may be provided"
  usage
  exit 1
fi

recipient="$(printf "%s" "$recipient" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"

if [ -z "$recipient" ]; then
  echo "FAIL recipient is required"
  usage
  exit 1
fi

case "$recipient" in
  *,*)
    echo "FAIL recipient must be a single email address, not a comma-separated list"
    exit 1
    ;;
esac

case "$recipient" in
  *@*.*)
    ;;
  *)
    echo "FAIL recipient does not look like an email address"
    exit 1
    ;;
esac

run_psql() {
  docker compose exec -T postgres psql \
    -X \
    -v ON_ERROR_STOP=1 \
    -U "${POSTGRES_USER:-email_ai_user}" \
    -d "${POSTGRES_DB:-email_ai}" \
    "$@"
}

if ! docker compose ps postgres >/dev/null 2>&1; then
  echo "FAIL postgres service is not available through docker compose"
  exit 1
fi

echo "Checking SES validation target in Business PostgreSQL."
echo "This script is validation-only: it does not create data, send email, or call listmonk."

summary="$(
  run_psql -At -F $'\t' -v recipient="$recipient" -c "
    SELECT 'active_clients', COUNT(*)::text
    FROM clients
    WHERE lower(status) IN ('active', 'trial')
    UNION ALL
    SELECT 'ready_campaigns', COUNT(*)::text
    FROM campaigns
    WHERE lower(status) IN ('ready', 'running')
      AND content_ready IS TRUE
      AND contacts_ready IS TRUE
      AND review_ready IS TRUE
    UNION ALL
    SELECT 'matching_contacts', COUNT(*)::text
    FROM contacts
    WHERE lower(email) = :'recipient'
    UNION ALL
    SELECT 'matching_campaign_relations', COUNT(*)::text
    FROM campaign_contacts
    INNER JOIN contacts
      ON contacts.id = campaign_contacts.contact_id
      AND contacts.client_id = campaign_contacts.client_id
    WHERE lower(contacts.email) = :'recipient';
  "
)"

printf "%s\n" "$summary" | while IFS=$'\t' read -r key value; do
  [ -z "$key" ] && continue
  echo "INFO ${key}=${value}"
done

target="$(
  run_psql -At -F $'\t' -v recipient="$recipient" -c "
    WITH candidate_targets AS (
      SELECT
        clients.id::text AS client_id,
        campaigns.id::text AS campaign_id,
        contacts.id::text AS contact_id,
        campaign_contacts.id::text AS campaign_contact_id,
        campaigns.status AS campaign_status,
        contacts.status AS contact_status,
        (
          SELECT COUNT(*)
          FROM campaign_contacts AS cc_total
          INNER JOIN contacts AS c_total
            ON c_total.id = cc_total.contact_id
            AND c_total.client_id = cc_total.client_id
          WHERE cc_total.client_id = campaigns.client_id
            AND cc_total.campaign_id = campaigns.id
        ) AS campaign_contact_count
      FROM campaign_contacts
      INNER JOIN contacts
        ON contacts.id = campaign_contacts.contact_id
        AND contacts.client_id = campaign_contacts.client_id
      INNER JOIN campaigns
        ON campaigns.id = campaign_contacts.campaign_id
        AND campaigns.client_id = campaign_contacts.client_id
      INNER JOIN clients
        ON clients.id = campaigns.client_id
      WHERE lower(contacts.email) = :'recipient'
        AND lower(clients.status) IN ('active', 'trial')
        AND lower(campaigns.status) IN ('ready', 'running')
        AND campaigns.content_ready IS TRUE
        AND campaigns.contacts_ready IS TRUE
        AND campaigns.review_ready IS TRUE
        AND lower(contacts.status) = 'sendable'
        AND NOT EXISTS (
          SELECT 1
          FROM suppression_list
          WHERE lower(suppression_list.email) = lower(contacts.email)
            AND (
              suppression_list.client_id = clients.id
              OR suppression_list.client_id IS NULL
            )
        )
    )
    SELECT
      client_id,
      campaign_id,
      contact_id,
      campaign_contact_id,
      campaign_status,
      contact_status,
      campaign_contact_count::text
    FROM candidate_targets
    WHERE campaign_contact_count = 1
    ORDER BY campaign_id, contact_id
    LIMIT 2;
  "
)"

target_count="$(printf "%s\n" "$target" | sed '/^[[:space:]]*$/d' | wc -l | tr -d '[:space:]')"

if [ "$target_count" -eq 0 ]; then
  echo "FAIL no controlled SES validation target matched the recipient"
  echo "Required state: active/trial client, ready/running campaign, content_ready=true, contacts_ready=true, review_ready=true, exactly one campaign contact, sendable contact, and no suppression row."
  exit 1
fi

if [ "$target_count" -gt 1 ]; then
  echo "FAIL more than one SES validation target matched the recipient"
  echo "Use a single clearly identified campaign target before attempting Milestone 12.1."
  exit 1
fi

IFS=$'\t' read -r client_id campaign_id contact_id campaign_contact_id campaign_status contact_status campaign_contact_count <<EOF_TARGET
$target
EOF_TARGET

echo "OK controlled SES validation target found"
echo "CLIENT_ID=${client_id}"
echo "CAMPAIGN_ID=${campaign_id}"
echo "CONTACT_ID=${contact_id}"
echo "CAMPAIGN_CONTACT_ID=${campaign_contact_id}"
echo "CAMPAIGN_STATUS=${campaign_status}"
echo "CONTACT_STATUS=${contact_status}"
echo "CAMPAIGN_CONTACT_COUNT=${campaign_contact_count}"
echo "No email was sent."
