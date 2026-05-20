import { StatusBadge } from "../ui/StatusBadge";
import type { AdminBlockedSendItem } from "../../types";
import { formatDateTimeInRome } from "../shared/dateTime";

interface AdminBlockedSendsListProps {
  items: AdminBlockedSendItem[];
}

function formatDateTimeLabel(value: string): string {
  return formatDateTimeInRome(value);
}

function getDecisionLabel(decision: AdminBlockedSendItem["decision"]): string {
  switch (decision) {
    case "blocked":
      return "Bloccato";
    case "dry_run":
      return "Dry run";
    case "authorized":
      return "Autorizzato";
    default:
      return decision;
  }
}

function getDecisionVariant(decision: AdminBlockedSendItem["decision"]) {
  switch (decision) {
    case "blocked":
      return "danger" as const;
    case "dry_run":
      return "warning" as const;
    case "authorized":
      return "success" as const;
    default:
      return "neutral" as const;
  }
}

export function AdminBlockedSendsList({
  items,
}: AdminBlockedSendsListProps) {
  return (
    <div className="admin-record-list">
      {items.map((item) => (
        <article key={item.id} className="admin-record-row">
          <div className="admin-record-row__primary">
            <div className="admin-record-row__copy">
              <strong>{item.campaignName || "Campagna non disponibile"}</strong>
              <span>
                {item.clientName} | {item.clientEmail}
              </span>
            </div>
            <StatusBadge
              label={getDecisionLabel(item.decision)}
              variant={getDecisionVariant(item.decision)}
            />
          </div>

          <dl className="admin-record-grid">
            <div>
              <dt>Client</dt>
              <dd>{item.clientName}</dd>
            </div>
            <div>
              <dt>Campaign</dt>
              <dd>{item.campaignName || "Non disponibile"}</dd>
            </div>
            <div>
              <dt>Creato</dt>
              <dd>{formatDateTimeLabel(item.createdAt)}</dd>
            </div>
            <div>
              <dt>Client ID</dt>
              <dd>{item.clientId}</dd>
            </div>
            <div>
              <dt>Campaign ID</dt>
              <dd>{item.campaignId || "Non disponibile"}</dd>
            </div>
            <div>
              <dt>Decisione</dt>
              <dd>{getDecisionLabel(item.decision)}</dd>
            </div>
          </dl>

          <p className="admin-record-row__note">{item.reason}</p>
        </article>
      ))}
    </div>
  );
}
