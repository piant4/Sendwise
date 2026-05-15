"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type {
  AdminCampaignContactsSummary,
  AdminCampaignDetail,
  AdminCampaignReadinessSummary,
} from "../../types";
import {
  normalizeCampaignWizardStep,
  type CampaignWizardStep,
} from "../shared/campaignUi";
import { AdminCampaignContentStep } from "./AdminCampaignContentStep";
import { AdminCampaignContactsPanel } from "./AdminCampaignContactsPanel";
import { AdminCampaignReviewPanel } from "./AdminCampaignReviewPanel";
import { AdminCampaignSetupForm } from "./AdminCampaignSetupForm";
import { AdminCampaignSetupProgress } from "./AdminCampaignSetupProgress";

interface AdminCampaignWizardShellProps {
  campaign: AdminCampaignDetail;
  contacts: AdminCampaignContactsSummary | null;
  summary: AdminCampaignReadinessSummary | null;
  initialStep?: string | null;
}

const STEP_ORDER: CampaignWizardStep[] = ["setup", "content", "recipients", "review"];

export function AdminCampaignWizardShell({
  campaign,
  contacts,
  summary,
  initialStep,
}: AdminCampaignWizardShellProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<CampaignWizardStep>(
    normalizeCampaignWizardStep(initialStep || campaign.currentStep),
  );

  const currentIndex = STEP_ORDER.indexOf(currentStep);
  const headerSummary = useMemo(
    () => [
      campaign.clientName,
      campaign.subject?.trim() || "Oggetto email da completare",
      "Invio sempre governato dal backend",
    ].join(" / "),
    [campaign.clientName, campaign.subject],
  );

  function goToStep(step: CampaignWizardStep) {
    setCurrentStep(step);
    router.replace(`/admin/campaigns/${campaign.campaignId}?mode=edit&step=${step}`, {
      scroll: false,
    });
  }

  function goNext() {
    const nextStep = STEP_ORDER[currentIndex + 1];

    if (nextStep) {
      goToStep(nextStep);
    }
  }

  function goBack() {
    const previousStep = STEP_ORDER[currentIndex - 1];

    if (previousStep) {
      goToStep(previousStep);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section
        className="admin-clients-card campaign-panel"
      >
        <div className="admin-clients-card__intro">
          <div>
            <p className="admin-surface__eyebrow">Setup guidato</p>
            <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
              Modifica campagna
            </h2>
            <p className="admin-clients-card__description">
              {headerSummary}. Lo step contenuto include modelli email locali modificabili prima del salvataggio.
            </p>
          </div>
        </div>
      </section>

      <AdminCampaignSetupProgress
        campaign={campaign}
        contacts={contacts}
        summary={summary}
        currentStep={currentStep}
        onStepSelect={goToStep}
      />

      {currentStep === "setup" ? (
        <AdminCampaignSetupForm
          campaign={campaign}
          onContinue={goNext}
        />
      ) : null}

      {currentStep === "content" ? (
        <AdminCampaignContentStep
          campaign={campaign}
          onBack={goBack}
          onContinue={goNext}
        />
      ) : null}

      {currentStep === "recipients" ? (
        <AdminCampaignContactsPanel
          campaignId={campaign.campaignId}
          contacts={contacts}
          onBack={goBack}
          onContinue={goNext}
        />
      ) : null}

      {currentStep === "review" ? (
        <AdminCampaignReviewPanel
          campaign={campaign}
          summary={summary}
          autoRun
          onBack={goBack}
        />
      ) : null}
    </div>
  );
}
