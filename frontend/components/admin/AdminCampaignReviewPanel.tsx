"use client";

import { useAuth } from "@clerk/nextjs";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
} from "../shared/campaignUi";
import { Button } from "../ui/button";
import { StatusBadge } from "../ui/StatusBadge";

interface AdminCampaignReviewPanelProps {
  campaign: AdminCampaignDetail;
  summary: AdminCampaignReadinessSummary | null;
  errorMessage?: string | null;
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

function getLatestReviewState(
  campaign: AdminCampaignDetail,
  result: AdminCampaignReviewResult | null,
) {
  return {
    contentReady: result?.contentReady ?? campaign.contentReady,
    contactsReady: result?.contactsReady ?? campaign.contactsReady,
    reviewReady: result?.reviewReady ?? campaign.reviewReady,
    currentStep: result?.currentStep ?? campaign.currentStep,
  };
}

export function AdminCampaignReviewPanel({
  campaign,
  summary,
  errorMessage,
}: AdminCampaignReviewPanelProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewResult, setReviewResult] =
    useState<AdminCampaignReviewResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const state = getLatestReviewState(campaign, reviewResult);
  const reviewReasons = [
    ...(reviewResult?.blockingErrors ?? summary?.blockingErrors ?? []),
    ...(reviewResult?.warnings ?? summary?.warnings ?? []),
  ].map(getReadableBackendReason);
  const eligibleContactCount =
    reviewResult?.eligibleContactCount ?? summary?.recipients.eligible ?? 0;
  const blockedContactCount =
    reviewResult?.blockedContactCount ?? summary?.recipients.blocked ?? 0;

  async function handleReview() {
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

  return (
    <section className="admin-clients-card" id="review">
      <div className="admin-clients-card__intro">
        <div>
          <p className="admin-surface__eyebrow">Review</p>
          <h2 className="admin-clients-card__title">Verifica campagna</h2>
          <p className="admin-clients-card__description">
            Esegue solo la review backend e aggiorna lo stato di prontezza.
          </p>
        </div>
        <StatusBadge
          label={state.reviewReady ? "Pronto" : "Non pronto"}
          variant={state.reviewReady ? "success" : "neutral"}
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
      {reviewResult ? (
        <p className="admin-clients-feedback" role="status">
          Review eseguita dal backend. Stato aggiornato dalla risposta API.
        </p>
      ) : null}
      {!state.reviewReady ? (
        <p className="admin-record-row__note">
          Review non pronta: completa setup, contenuto e destinatari, poi riesegui
          la verifica backend.
        </p>
      ) : null}

      <dl className="admin-record-grid">
        <div>
          <dt>Contenuto</dt>
          <dd>{state.contentReady ? "Pronto" : "Da completare"}</dd>
        </div>
        <div>
          <dt>Destinatari</dt>
          <dd>{state.contactsReady ? "Pronto" : "Non pronto"}</dd>
        </div>
        <div>
          <dt>Review</dt>
          <dd>{state.reviewReady ? "Pronto" : "Non pronto"}</dd>
        </div>
        <div>
          <dt>Step backend</dt>
          <dd>{state.currentStep}</dd>
        </div>
        <div>
          <dt>Contatti idonei</dt>
          <dd>{eligibleContactCount.toLocaleString("it-IT")}</dd>
        </div>
        <div>
          <dt>Contatti bloccati</dt>
          <dd>{blockedContactCount.toLocaleString("it-IT")}</dd>
        </div>
      </dl>

      {reviewReasons.length > 0 ? (
        <ul className="admin-record-row__note">
          {reviewReasons.map((reason) => (
            <li key={`${reason.raw}-${reason.label}`}>
              {reason.label}
              {reason.isKnown ? "" : `: ${reason.raw}`}
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-record-row__note">
          Nessun blocco o warning restituito dal backend.
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
        <Button
          type="button"
          size="default"
          className="admin-topbar-action admin-topbar-action--primary"
          disabled={isSubmitting}
          onClick={handleReview}
        >
          {isSubmitting ? (
            <Loader2 aria-hidden="true" className="admin-topbar-action__icon" />
          ) : (
            <ClipboardCheck aria-hidden="true" className="admin-topbar-action__icon" />
          )}
          {isSubmitting ? "Review..." : "Esegui review"}
        </Button>
      </div>
    </section>
  );
}
