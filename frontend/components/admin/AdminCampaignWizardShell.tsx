"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
          summary={summary}
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
