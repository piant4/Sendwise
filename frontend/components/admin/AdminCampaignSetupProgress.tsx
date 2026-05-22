import { AlertCircle, CheckCircle2, CircleDashed } from "lucide-react";
import type {
  AdminCampaignContactsSummary,
  AdminCampaignDetail,
  AdminCampaignReadinessSummary,
} from "../../types";
import {
  normalizeCampaignWizardStep,
  type CampaignWizardStep,
} from "../shared/campaignUi";

type StepState = "ready" | "needs-attention" | "not-ready";

interface AdminCampaignSetupProgressProps {
  campaign: AdminCampaignDetail;
  contacts: AdminCampaignContactsSummary | null;
  summary: AdminCampaignReadinessSummary | null;
  currentStep?: CampaignWizardStep;
  onStepSelect?: (step: CampaignWizardStep) => void;
}

interface WizardStep {
  id: CampaignWizardStep;
  label: string;
  state: StepState;
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
  const providerAccepted = summary?.logs.sent ?? 0;
  const prepared = summary?.logs.queued ?? 0;

  return [
    {
      id: "setup",
      label: "Setup",
      state: campaign.currentStep === "setup" ? "needs-attention" : "ready",
    },
    {
      id: "template",
      label: "Template",
      state:
        campaign.contentReady || campaign.currentStep !== "setup" ? "ready" : "needs-attention",
    },
    {
      id: "editor",
      label: "Editor",
      state: campaign.contentReady ? "ready" : "not-ready",
    },
    {
      id: "recipients",
      label: "Destinatari",
      state: campaign.contactsReady
        ? "ready"
        : recipientTotal > 0 && recipientEligible === 0
          ? "needs-attention"
          : "not-ready",
    },
    {
      id: "review",
      label: "Verifica",
      state: campaign.reviewReady
        ? "ready"
        : campaign.currentStep === "review" ||
            campaign.currentStep === "send" ||
            (campaign.contentReady && campaign.contactsReady)
          ? "needs-attention"
          : "not-ready",
    },
    {
      id: "send",
      label: "Invio",
      state:
        providerAccepted > 0
          ? "ready"
          : prepared > 0 || campaign.reviewReady || campaign.currentStep === "send"
            ? "needs-attention"
            : "not-ready",
    },
  ];
}

export function AdminCampaignSetupProgress({
  campaign,
  contacts,
  summary,
  currentStep,
  onStepSelect,
}: AdminCampaignSetupProgressProps) {
  const steps = buildSteps(campaign, contacts, summary);
  const activeStep = currentStep ?? normalizeCampaignWizardStep(campaign.currentStep);
  const activeIndex = Math.max(
    steps.findIndex((step) => step.id === activeStep),
    0,
  );
  const completion = `${((activeIndex + 1) / steps.length) * 100}%`;

  return (
    <nav
      className="admin-clients-card campaign-panel"
      aria-label="Avanzamento setup campagna"
      style={{ display: "grid", gap: 14 }}
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
          <p className="admin-surface__eyebrow">Progressione</p>
          <h2 className="admin-clients-card__title">Step campagna</h2>
        </div>
        <div style={{ display: "grid", gap: 6, textAlign: "right" }}>
          <strong style={{ color: "#0f172a" }}>
            Step {activeIndex + 1} di {steps.length}
          </strong>
          <span className="admin-record-row__note">
            Aggiornato con lo stato attuale della campagna
          </span>
        </div>
      </div>
      <div
        style={{
          background: "rgba(148, 163, 184, 0.18)",
          borderRadius: 999,
          height: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "linear-gradient(90deg, #1d4ed8 0%, #60a5fa 100%)",
            borderRadius: 999,
            height: "100%",
            transition: "width 180ms ease",
            width: completion,
          }}
        />
      </div>
      <div className="campaign-stepper">
        {steps.map((step) => {
          const Icon = getStepIcon(step.state);
          const isCurrent = activeStep === step.id;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepSelect?.(normalizeCampaignWizardStep(step.id))}
              className="campaign-step-button"
              data-current={isCurrent}
              data-ready={step.state === "ready"}
              style={{ cursor: onStepSelect ? "pointer" : "default" }}
            >
              <span className="campaign-step-button__header">
                <strong className="campaign-step-button__title">
                  <Icon aria-hidden="true" size={18} /> {step.label}
                </strong>
                {isCurrent ? (
                  <span className="campaign-step-button__state">Attuale</span>
                ) : null}
              </span>
              <span className="admin-record-chip">{getStepStateLabel(step.state)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
