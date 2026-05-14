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
      return "Attenzione";
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
          ? "Campagna creata dal backend; completa i campi base."
          : "Base campagna presente nel backend.",
    },
    {
      id: "content",
      label: "Contenuto",
      state: campaign.contentReady ? "ready" : "not-ready",
      helper: campaign.contentReady
        ? "Contenuto salvato e marcato pronto dal backend."
        : "Oggetto e HTML devono risultare pronti lato backend.",
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
            ? "Tutti i destinatari risultano bloccati."
            : campaign.contactsReady
              ? "Destinatari pronti secondo il backend."
              : "Destinatari presenti, review backend ancora necessaria.",
    },
    {
      id: "review",
      label: "Review",
      state: campaign.reviewReady ? "ready" : "not-ready",
      helper: campaign.reviewReady
        ? "Review pronta secondo il backend."
        : "Esegui la review quando setup, contenuto e destinatari sono completi.",
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
        alignSelf: "start",
        display: "grid",
        gap: 14,
        position: "sticky",
        top: 20,
      }}
    >
      <div>
        <p className="admin-surface__eyebrow">Setup guidato</p>
        <h2 className="admin-clients-card__title">Flusso campagna</h2>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {steps.map((step) => {
          const Icon = getStepIcon(step.state);
          const isCurrent = campaign.currentStep === step.id;

          return (
            <a
              key={step.id}
              href={`#${anchorByStep[step.id] ?? step.id}`}
              style={{
                background: isCurrent
                  ? "rgba(93, 118, 78, 0.12)"
                  : "rgba(250, 250, 247, 0.78)",
                border: isCurrent
                  ? "1px solid rgba(93, 118, 78, 0.28)"
                  : "1px solid rgba(202, 207, 214, 0.58)",
                borderRadius: 16,
                color: "inherit",
                display: "grid",
                gap: 6,
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
                <strong style={{ color: "var(--sw-olive)" }}>
                  <Icon aria-hidden="true" size={18} /> {step.label}
                </strong>
                <span className="admin-record-chip">
                  {isCurrent ? "Step attuale" : getStepStateLabel(step.state)}
                </span>
              </span>
              <span className="admin-record-row__note">{step.helper}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
