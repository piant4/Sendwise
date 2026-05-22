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
  initialTemplateId?: string | null;
  forceTemplateApply?: boolean;
}

const STEP_ORDER: CampaignWizardStep[] = [
  "setup",
  "template",
  "editor",
  "recipients",
  "review",
  "send",
];

export function AdminCampaignWizardShell({
  campaign,
  contacts,
  summary,
  initialStep,
  initialTemplateId,
  forceTemplateApply = false,
}: AdminCampaignWizardShellProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<CampaignWizardStep>(
    normalizeCampaignWizardStep(initialStep || campaign.currentStep),
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    initialTemplateId ?? null,
  );
  const [shouldForceTemplateApply, setShouldForceTemplateApply] = useState(forceTemplateApply);

  const currentIndex = STEP_ORDER.indexOf(currentStep);

  function goToStep(step: CampaignWizardStep, options?: { templateId?: string | null; force?: boolean }) {
    const templateId =
      options?.templateId !== undefined ? options.templateId : selectedTemplateId;
    const force = options?.force ?? false;

    setCurrentStep(step);
    if (options?.templateId !== undefined) {
      setSelectedTemplateId(options.templateId);
    }
    setShouldForceTemplateApply(force);

    const params = new URLSearchParams({
      mode: "edit",
      step,
    });
    if (templateId) {
      params.set("template", templateId);
    }
    if (force) {
      params.set("replace_template", "1");
    }

    router.replace(`/admin/campaigns/${campaign.campaignId}?${params.toString()}`, {
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

  function handleTemplateSelect(templateId: string, force = false) {
    goToStep("editor", { templateId, force });
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

      {currentStep === "template" ? (
        <AdminCampaignContentStep
          campaign={campaign}
          mode="template"
          onBack={goBack}
          onTemplateSelect={handleTemplateSelect}
        />
      ) : null}

      {currentStep === "editor" ? (
        <AdminCampaignContentStep
          campaign={campaign}
          forceTemplateApply={shouldForceTemplateApply}
          initialTemplateId={selectedTemplateId}
          mode="editor"
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
          onContinue={goNext}
        />
      ) : null}

      {currentStep === "send" ? (
        <AdminCampaignReviewPanel
          campaign={campaign}
          mode="send"
          summary={summary}
          onBack={goBack}
        />
      ) : null}
    </div>
  );
}
