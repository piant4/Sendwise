import { StatusBadge } from "../ui/StatusBadge";
import type { AdminSystemStatus } from "../../types";
import { formatDateTimeInRome } from "../shared/dateTime";

interface AdminSystemHealthPanelProps {
  status: AdminSystemStatus;
}

function formatDateTimeLabel(value: string): string {
  return formatDateTimeInRome(value);
}

function getBooleanBadge(value: boolean) {
  return value
    ? ({ label: "Configurato", variant: "success" } as const)
    : ({ label: "Assente", variant: "warning" } as const);
}

export function AdminSystemHealthPanel({
  status,
}: AdminSystemHealthPanelProps) {
  const dbBadge =
    status.dbStatus === "ok"
      ? { label: "OK", variant: "success" as const }
      : { label: "Degradato", variant: "danger" as const };
  const emailBadge = status.emailSendingEnabled
    ? { label: "Abilitato", variant: "warning" as const }
    : { label: "Disabilitato", variant: "neutral" as const };
  const providerBadge = status.realSendAvailable
    ? { label: status.providerModeLabel, variant: "success" as const }
    : { label: status.providerModeLabel, variant: "neutral" as const };
  const authProviderBadge = getBooleanBadge(status.authProviderConfigured);
  const clerkManagementBadge = getBooleanBadge(status.clerkManagementApiConfigured);
  const frontendOriginBadge = getBooleanBadge(status.frontendOriginConfigured);
  const deliveryEngineBadge = getBooleanBadge(status.deliveryEngineConfigured);

  return (
    <div className="admin-system-panel">
      <div className="admin-system-list">
        <div className="admin-system-item">
          <span>Backend API</span>
          <StatusBadge label="OK" variant="success" />
        </div>
        <div className="admin-system-item">
          <span>Database</span>
          <StatusBadge label={dbBadge.label} variant={dbBadge.variant} />
        </div>
        <div className="admin-system-item">
          <span>Invio email</span>
          <StatusBadge label={emailBadge.label} variant={emailBadge.variant} />
        </div>
        <div className="admin-system-item">
          <span>Provider mode</span>
          <StatusBadge label={providerBadge.label} variant={providerBadge.variant} />
        </div>
        <div className="admin-system-item">
          <span>Ambiente</span>
          <strong className="admin-row__stat">{status.environment}</strong>
        </div>
      </div>

      <div className="admin-system-config-grid">
        <div className="admin-system-config-card">
          <span>Auth Clerk</span>
          <StatusBadge
            label={authProviderBadge.label}
            variant={authProviderBadge.variant}
          />
        </div>
        <div className="admin-system-config-card">
          <span>Clerk management</span>
          <StatusBadge
            label={clerkManagementBadge.label}
            variant={clerkManagementBadge.variant}
          />
        </div>
        <div className="admin-system-config-card">
          <span>Frontend origin</span>
          <StatusBadge
            label={frontendOriginBadge.label}
            variant={frontendOriginBadge.variant}
          />
        </div>
        <div className="admin-system-config-card">
          <span>Delivery engine</span>
          <StatusBadge
            label={deliveryEngineBadge.label}
            variant={deliveryEngineBadge.variant}
          />
        </div>
        <div className="admin-system-config-card">
          <span>SES live validation</span>
          <StatusBadge
            label={
              status.sesLiveValidationStatus === "pending"
                ? "AWS approval pending"
                : "Non richiesta"
            }
            variant={
              status.sesLiveValidationStatus === "pending" ? "warning" : "neutral"
            }
          />
        </div>
        <div className="admin-system-config-card">
          <span>Mailpit dev</span>
          <StatusBadge
            label={status.mailpitDevMode ? "Mailpit/dev" : "Assente"}
            variant={status.mailpitDevMode ? "success" : "neutral"}
          />
        </div>
      </div>

      {status.emailProvider === "ses" ? (
        <p className="admin-system-note">
          SES resta in modalita sandbox. L&apos;invio production rimane bloccato finche
          AWS non approva l&apos;accesso production; gli inviti nativi Clerk non sono
          coinvolti.
        </p>
      ) : null}

      <p className="admin-system-note">
        Ultimo aggiornamento: {formatDateTimeLabel(status.generatedAt)}
      </p>
    </div>
  );
}
