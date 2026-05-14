import { AlertCircle, CheckCircle2, CircleDashed } from "lucide-react";
import type {
  AdminCampaignContactsSummary,
  AdminCampaignDetail,
  AdminCampaignReadinessSummary,
} from "../../types";

type StepState = "ready" | "needs-attention" | "not-ready";

interface AdminCampaignSetupProgressProps {
  campaign: AdminCampaignDetail;
  contacts: AdminCampaignContactsSummary | null;
  summary: AdminCampaignReadinessSummary | null;
}

interface WizardStep {
  id: string;
  label: string;
  state: StepState;
  helper: string;
}

function getStepStateLabel(state: StepState): string {
  switch (state) {
    case "ready":
      return "Pronto";
    case "needs-attention":
      return "Richiede attenzione";
    default:
      return "Non pronto";
  }
}

function getStepIcon(state: StepState) {
  if (state === "ready") {
    return CheckCircle2;
  }

  if (state === "needs-attention") {
    return AlertCircle;
  }

  return CircleDashed;
}

function buildSteps(
  campaign: AdminCampaignDetail,
  contacts: AdminCampaignContactsSummary | null,
  summary: AdminCampaignReadinessSummary | null,
): WizardStep[] {
  const recipientTotal = contacts?.total ?? summary?.recipients.total ?? 0;
  const recipientEligible = contacts?.eligible ?? summary?.recipients.eligible ?? 0;
  const recipientBlocked = contacts?.blocked ?? summary?.recipients.blocked ?? 0;

  return [
    {
      id: "setup",
      label: "Setup",
      state: campaign.currentStep === "setup" ? "needs-attention" : "ready",
      helper:
        campaign.currentStep === "setup"
          ? "Completa i campi base."
          : "Base presente.",
    },
    {
      id: "content",
      label: "Contenuto",
      state: campaign.contentReady ? "ready" : "not-ready",
      helper: campaign.contentReady ? "Pronto dal backend." : "Oggetto e contenuto richiesti.",
    },
    {
      id: "recipients",
      label: "Destinatari",
      state: campaign.contactsReady
        ? "ready"
        : recipientTotal > 0 && recipientEligible === 0
          ? "needs-attention"
          : "not-ready",
      helper:
        recipientTotal === 0
          ? "Nessun destinatario associato."
        : recipientEligible === 0 && recipientBlocked === recipientTotal
            ? "Destinatari bloccati."
            : campaign.contactsReady
              ? `${recipientEligible.toLocaleString("it-IT")} idonei.`
              : "Review backend necessaria.",
    },
    {
      id: "review",
      label: "Review",
      state: campaign.reviewReady ? "ready" : "not-ready",
      helper: campaign.reviewReady ? "Pronta dal backend." : "In attesa di verifica.",
    },
  ];
}

export function AdminCampaignSetupProgress({
  campaign,
  contacts,
  summary,
}: AdminCampaignSetupProgressProps) {
  const steps = buildSteps(campaign, contacts, summary);
  const anchorByStep: Record<string, string> = {
    setup: "setup-base",
    content: "content",
    recipients: "destinatari",
    review: "review",
  };

  return (
    <nav
      className="admin-clients-card"
      aria-label="Avanzamento setup campagna"
      style={{
        display: "grid",
        gap: 16,
        padding: 20,
      }}
    >
      <div
        style={{
          alignItems: "end",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <div>
          <p className="admin-surface__eyebrow">Setup guidato</p>
          <h2 className="admin-clients-card__title">Flusso campagna</h2>
        </div>
        <span className="admin-record-row__note">
          Prontezza letta dal backend
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        }}
      >
        {steps.map((step) => {
          const Icon = getStepIcon(step.state);
          const isCurrent = campaign.currentStep === step.id;

          return (
            <a
              key={step.id}
              href={`#${anchorByStep[step.id] ?? step.id}`}
              style={{
                background: isCurrent
                  ? "rgba(93, 118, 78, 0.1)"
                  : "rgba(250, 250, 247, 0.72)",
                border: isCurrent
                  ? "1px solid rgba(93, 118, 78, 0.32)"
                  : "1px solid rgba(202, 207, 214, 0.58)",
                borderRadius: 14,
                color: "inherit",
                display: "grid",
                gap: 6,
                minHeight: 118,
                padding: 14,
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: 8,
                  justifyContent: "space-between",
                }}
              >
                <strong
                  style={{
                    alignItems: "center",
                    color: "var(--sw-olive)",
                    display: "flex",
                    gap: 8,
                  }}
                >
                  <Icon aria-hidden="true" size={18} /> {step.label}
                </strong>
              </span>
              <span
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                <span className="admin-record-chip">
                  {getStepStateLabel(step.state)}
                </span>
                {isCurrent ? (
                  <span className="admin-record-chip">Step attuale</span>
                ) : null}
              </span>
              <span className="admin-record-row__note">{step.helper}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
