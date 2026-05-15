"use client";

import { useAuth } from "@clerk/nextjs";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  isApiError,
  reviewAdminCampaign,
} from "../../lib/api";
import type {
  AdminCampaignDetail,
  AdminCampaignReadinessSummary,
  AdminCampaignReviewResult,
} from "../../types";
import {
  getReadableBackendReason,
  getCampaignStepLabel,
} from "../shared/campaignUi";
import { Button } from "../ui/button";
import { StatusBadge } from "../ui/StatusBadge";

interface AdminCampaignReviewPanelProps {
  campaign: AdminCampaignDetail;
  summary: AdminCampaignReadinessSummary | null;
  errorMessage?: string | null;
  autoRun?: boolean;
  onBack?: () => void;
}

function getSafeReviewErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.isNetworkError) {
      return "Il browser non riesce a raggiungere il backend Sendwise.";
    }

    if (error.status === 401 || error.status === 403) {
      return "La sessione admin non e valida per eseguire la review.";
    }

    if (error.status === 404) {
      return "Campagna non trovata o non disponibile per questa sessione admin.";
    }

    if (error.status === 409) {
      return "Il backend ha rifiutato la review per lo stato corrente della campagna.";
    }

    if (error.status === 422) {
      return "Il backend non puo eseguire la review con i dati attuali.";
    }

    if (error.detail.trim()) {
      return error.detail;
    }
  }

  return "Non e stato possibile eseguire la review. Riprova.";
}

function getInitialState(
  campaign: AdminCampaignDetail,
  summary: AdminCampaignReadinessSummary | null,
) {
  return {
    allowedToSend: summary?.canSend ?? false,
    canSendWhenEnabled: summary?.canSend ?? false,
    contentReady: summary?.campaign.contentReady ?? campaign.contentReady,
    contactsReady: summary?.campaign.contactsReady ?? campaign.contactsReady,
    reviewReady: summary?.campaign.reviewReady ?? campaign.reviewReady,
    currentStep: summary?.campaign.currentStep ?? campaign.currentStep,
    warnings: summary?.warnings ?? [],
    blockingErrors: summary?.blockingErrors ?? [],
    eligibleContactCount: summary?.recipients.eligible ?? 0,
    blockedContactCount: summary?.recipients.blocked ?? 0,
  };
}

function getReadinessLabel(value: boolean): string {
  return value ? "Pronto" : "Non pronto";
}

function getBooleanLabel(value: boolean): string {
  return value ? "Sì" : "No";
}

export function AdminCampaignReviewPanel({
  campaign,
  summary,
  errorMessage,
  autoRun = false,
  onBack,
}: AdminCampaignReviewPanelProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const autoRequestedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewResult, setReviewResult] =
    useState<AdminCampaignReviewResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const state = reviewResult ?? getInitialState(campaign, summary);
  const reviewReasons = [...state.blockingErrors, ...state.warnings].map(
    getReadableBackendReason,
  );

  async function runReview() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const token = await getToken();
      const result = await reviewAdminCampaign(campaign.campaignId, token);
      setReviewResult(result);
      router.refresh();
    } catch (error) {
      setFormError(getSafeReviewErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!autoRun || autoRequestedRef.current || campaign.reviewReady) {
      return;
    }

    autoRequestedRef.current = true;
    void (async () => {
      setIsSubmitting(true);
      setFormError(null);

      try {
        const token = await getToken();
        const result = await reviewAdminCampaign(campaign.campaignId, token);
        setReviewResult(result);
        router.refresh();
      } catch (error) {
        setFormError(getSafeReviewErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    })();
  }, [autoRun, campaign.campaignId, campaign.reviewReady, getToken, router]);

  return (
    <section className="admin-clients-card campaign-panel" id="review">
      <div className="admin-clients-card__intro">
        <div>
          <p className="admin-surface__eyebrow">Step 4</p>
          <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
            Verifica finale
          </h2>
        </div>
        <StatusBadge
          label={state.reviewReady ? "Pronta" : "Da verificare"}
          variant={state.reviewReady ? "success" : "warning"}
        />
      </div>

      {errorMessage ? (
        <p className="admin-clients-feedback admin-clients-feedback--error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {formError ? (
        <p className="admin-clients-feedback admin-clients-feedback--error" role="alert">
          {formError}
        </p>
      ) : null}
      {isSubmitting ? (
        <p className="admin-clients-feedback" role="status">
          Verifica campagna in corso...
        </p>
      ) : null}
      {reviewResult ? (
        <p className="admin-clients-feedback" role="status">
          Verifica completata dal backend. Nessun invio e stato avviato.
        </p>
      ) : null}

      <dl className="admin-record-grid" style={{ marginTop: 18 }}>
        <div>
          <dt>Invio consentito</dt>
          <dd>{getBooleanLabel(state.allowedToSend)}</dd>
        </div>
        <div>
          <dt>Inviabile quando l&apos;invio reale sara attivo</dt>
          <dd>{getBooleanLabel(state.canSendWhenEnabled)}</dd>
        </div>
        <div>
          <dt>Contenuto</dt>
          <dd>{getReadinessLabel(state.contentReady)}</dd>
        </div>
        <div>
          <dt>Destinatari</dt>
          <dd>{getReadinessLabel(state.contactsReady)}</dd>
        </div>
        <div>
          <dt>Review</dt>
          <dd>{getReadinessLabel(state.reviewReady)}</dd>
        </div>
        <div>
          <dt>Step operativo</dt>
          <dd>{getCampaignStepLabel(state.currentStep)}</dd>
        </div>
        <div>
          <dt>Idonei</dt>
          <dd>{state.eligibleContactCount.toLocaleString("it-IT")}</dd>
        </div>
        <div>
          <dt>Bloccati</dt>
          <dd>{state.blockedContactCount.toLocaleString("it-IT")}</dd>
        </div>
      </dl>

      {reviewReasons.length > 0 ? (
        <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
          <div>
            <strong style={{ color: "#0f172a" }}>Warning e blocchi backend</strong>
          </div>
          <ul className="admin-record-row__note" style={{ margin: 0 }}>
            {reviewReasons.map((reason) => (
              <li key={`${reason.raw}-${reason.label}`}>
                {reason.label}
                {reason.isKnown ? "" : `: ${reason.raw}`}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="admin-record-row__note" style={{ marginTop: 18 }}>
          Nessun warning o errore bloccante restituito dal backend.
        </p>
      )}

      <div className="campaign-action-row">
        <Button
          type="button"
          variant="outline"
          className="admin-topbar-action campaign-action campaign-action--secondary"
          onClick={onBack}
          style={{ minWidth: 148 }}
        >
          Indietro
        </Button>
        <Button
          type="button"
          className="admin-topbar-action campaign-action campaign-action--primary"
          disabled={isSubmitting}
          onClick={runReview}
          style={{ minWidth: 190 }}
        >
          {isSubmitting ? (
            <Loader2 aria-hidden="true" className="admin-topbar-action__icon" />
          ) : (
            <ClipboardCheck aria-hidden="true" className="admin-topbar-action__icon" />
          )}
          {isSubmitting ? "Verifica..." : "Completa verifica"}
        </Button>
      </div>
    </section>
  );
}
