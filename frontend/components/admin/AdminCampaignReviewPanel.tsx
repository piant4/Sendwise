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
    <section className="admin-clients-card" id="review">
      <div className="admin-clients-card__intro">
        <div>
          <p className="admin-surface__eyebrow">Step 4</p>
          <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
            Verifica finale
          </h2>
          <p className="admin-clients-card__description">
            Questo step esegue la review backend e mostra soltanto lo stato operativo restituito dalle API.
          </p>
        </div>
        <StatusBadge
          label={state.reviewReady ? "Pronta" : "Da verificare"}
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
          <dt>allowed_to_send</dt>
          <dd>{state.allowedToSend ? "true" : "false"}</dd>
        </div>
        <div>
          <dt>can_send_when_enabled</dt>
          <dd>{state.canSendWhenEnabled ? "true" : "false"}</dd>
        </div>
        <div>
          <dt>content_ready</dt>
          <dd>{state.contentReady ? "true" : "false"}</dd>
        </div>
        <div>
          <dt>contacts_ready</dt>
          <dd>{state.contactsReady ? "true" : "false"}</dd>
        </div>
        <div>
          <dt>review_ready</dt>
          <dd>{state.reviewReady ? "true" : "false"}</dd>
        </div>
        <div>
          <dt>Step backend</dt>
          <dd>{state.currentStep}</dd>
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

      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          marginTop: 18,
        }}
      >
        <Button
          type="button"
          variant="outline"
          className="admin-topbar-action admin-topbar-action--secondary"
          onClick={onBack}
          style={{
            borderColor: "rgba(148, 163, 184, 0.45)",
            color: "#0f172a",
            minWidth: 148,
          }}
        >
          Indietro
        </Button>
        <Button
          type="button"
          className="admin-topbar-action admin-topbar-action--primary"
          disabled={isSubmitting}
          onClick={runReview}
          style={{
            background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
            border: "1px solid rgba(37, 99, 235, 0.18)",
            boxShadow: "0 16px 34px rgba(37, 99, 235, 0.24)",
            color: "#f8fbff",
            minWidth: 190,
          }}
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
