"use client";

import { useAuth } from "@clerk/nextjs";
import { AlertCircle, CheckCircle2, ClipboardCheck, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  isApiConfigurationError,
  isApiError,
  reviewAdminCampaign,
  sendAdminCampaign,
} from "../../lib/api";
import type {
  AdminCampaignDispatchResult,
  AdminCampaignDetail,
  AdminCampaignReadinessSummary,
  AdminCampaignReviewResult,
} from "../../types";
import {
  dedupeReviewReasons,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
  getCampaignReviewStateMeta,
  getCampaignStepLabel,
  getReadableBackendReason,
} from "../shared/campaignUi";
import { Button } from "../ui/button";
import { StatusBadge } from "../ui/StatusBadge";
import type { CampaignStatus } from "../../types";

interface AdminCampaignReviewPanelProps {
  campaign: AdminCampaignDetail;
  summary: AdminCampaignReadinessSummary | null;
  errorMessage?: string | null;
  autoRun?: boolean;
  onBack?: () => void;
}

function getSafeReviewErrorMessage(error: unknown): string {
  if (isApiConfigurationError(error)) {
    return "Configurazione API non valida per questo ambiente.";
  }

  if (isApiError(error)) {
    if (error.isNetworkError) {
      return "Il browser non riesce a completare la verifica in questo momento.";
    }

    if (error.status === 401 || error.status === 403) {
      return "La sessione admin non è valida per eseguire la verifica.";
    }

    if (error.status === 404) {
      return "Campagna non trovata o non disponibile per questa sessione admin.";
    }

    if (error.status === 409) {
      return "La verifica non è disponibile con lo stato attuale della campagna.";
    }

    if (error.status === 422) {
      return "Completa i dati mancanti e poi riprova la verifica.";
    }

    if (error.status !== null && error.status >= 500) {
      return "Il backend ha restituito un errore durante la verifica. Riprova tra poco.";
    }

    if (error.status !== null && error.status >= 400) {
      return "Il backend ha rifiutato la verifica per questa campagna.";
    }

    if (error.detail.trim()) {
      return error.detail;
    }
  }

  return "Non è stato possibile eseguire la verifica. Riprova.";
}

function getInitialState(
  campaign: AdminCampaignDetail,
  summary: AdminCampaignReadinessSummary | null,
) {
  return {
    status: summary?.campaign.status ?? campaign.status,
    allowedToSend: summary?.canSend ?? false,
    canSendWhenEnabled: summary?.canSendWhenEnabled ?? false,
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

type ChecklistState = "passed" | "warning" | "failed";

interface ReviewChecklistItem {
  id: string;
  label: string;
  state: ChecklistState;
  reason: string;
  nextAction: string;
}

function getChecklistStateLabel(state: ChecklistState): string {
  switch (state) {
    case "passed":
      return "Ok";
    case "warning":
      return "Attenzione";
    default:
      return "Da risolvere";
  }
}

function getChecklistStateIcon(state: ChecklistState) {
  if (state === "passed") {
    return CheckCircle2;
  }

  if (state === "warning") {
    return AlertCircle;
  }

  return XCircle;
}

function buildReviewChecklist(state: {
  status: CampaignStatus;
  allowedToSend: boolean;
  canSendWhenEnabled: boolean;
  contentReady: boolean;
  contactsReady: boolean;
  reviewReady: boolean;
  eligibleContactCount: number;
  blockedContactCount: number;
}): ReviewChecklistItem[] {
  const statusLabel = getCampaignStatusLabel(state.status);
  const statusVariant = getCampaignStatusVariant(state.status);
  const stateCampaignStatusReady =
    state.status === "ready" || state.status === "running";

  return [
    {
      id: "content",
      label: "Contenuto email",
      state: state.contentReady ? "passed" : "failed",
      reason: state.contentReady
        ? "Oggetto e corpo HTML risultano salvati."
        : "La campagna non ha ancora un contenuto completo e salvato.",
      nextAction: state.contentReady
        ? "Nessuna azione richiesta."
        : "Completa e salva oggetto e contenuto email.",
    },
    {
      id: "recipients",
      label: "Destinatari",
      state: state.contactsReady ? "passed" : "failed",
      reason: state.contactsReady
        ? "La campagna ha almeno un destinatario associato."
        : "Non ci sono destinatari associati pronti per la review.",
      nextAction: state.contactsReady
        ? "Nessuna azione richiesta."
        : "Aggiungi almeno un destinatario alla campagna.",
    },
    {
      id: "eligibility",
      label: "Idoneità destinatari",
      state:
        state.eligibleContactCount === 0
          ? "failed"
          : state.blockedContactCount > 0
            ? "warning"
            : "passed",
      reason:
        state.eligibleContactCount === 0
          ? "Nessun destinatario risulta idoneo all'invio."
          : state.blockedContactCount > 0
            ? `${state.eligibleContactCount.toLocaleString("it-IT")} idonei, ${state.blockedContactCount.toLocaleString("it-IT")} bloccati.`
            : `${state.eligibleContactCount.toLocaleString("it-IT")} destinatari idonei e nessun bloccato.`,
      nextAction:
        state.eligibleContactCount === 0
          ? "Rivedi i destinatari esclusi e mantieni almeno un contatto idoneo."
          : state.blockedContactCount > 0
            ? "Controlla i destinatari bloccati prima dell'invio reale."
            : "Nessuna azione richiesta.",
    },
    {
      id: "status",
      label: "Stato campagna",
      state: state.reviewReady
        ? "passed"
        : stateCampaignStatusReady
          ? "warning"
          : "failed",
      reason: state.reviewReady
        ? `La review ha portato la campagna in stato ${statusLabel.toLowerCase()}.`
        : state.status === "draft"
          ? "La campagna è ancora in bozza."
          : statusVariant === "warning"
            ? `La campagna è in stato ${statusLabel.toLowerCase()}.`
            : `La campagna è in stato ${statusLabel.toLowerCase()} e non può ancora essere inviata.`,
      nextAction: state.reviewReady
        ? "Nessuna azione richiesta."
        : state.status === "draft"
          ? "Esegui o riesegui la review per portarla in stato Pronta."
          : state.status === "paused"
            ? "Riporta la campagna in stato Pronta prima dell'invio."
            : "Porta la campagna in uno stato inviabile prima dell'invio.",
    },
    {
      id: "real-send",
      label: "Invio reale",
      state: state.allowedToSend
        ? "passed"
        : state.canSendWhenEnabled
          ? "warning"
          : "failed",
      reason: state.allowedToSend
        ? "Il backend consentirebbe l'invio reale in questo ambiente."
        : state.canSendWhenEnabled
          ? "La campagna è pronta, ma l'invio reale è disattivato in questo ambiente."
          : "Il backend non consentirebbe ancora l'invio reale.",
      nextAction: state.allowedToSend
        ? "L'invio resta separato dalla review e non è stato avviato."
        : state.canSendWhenEnabled
          ? "Attiva l'invio reale solo nell'ambiente previsto, poi usa il flusso di invio."
          : "Risolvi gli elementi sopra prima di considerare l'invio.",
    },
  ];
}

function getDispatchOutcomeLabel(result: AdminCampaignDispatchResult): string {
  if (result.status === "queued" && result.allowed) {
    return "Invio accodato";
  }

  if (result.status === "blocked" || result.status === "dispatch_blocked") {
    return "Invio bloccato";
  }

  return "Invio non eseguito";
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
  const [isDispatching, setIsDispatching] = useState(false);
  const [reviewResult, setReviewResult] =
    useState<AdminCampaignReviewResult | null>(null);
  const [dispatchResult, setDispatchResult] =
    useState<AdminCampaignDispatchResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const state = reviewResult ?? getInitialState(campaign, summary);
  const reviewExecuted = reviewResult !== null || campaign.reviewReady;
  const reviewState = getCampaignReviewStateMeta(state.reviewReady, reviewExecuted);
  const checklistItems = buildReviewChecklist(state);
  const blockingReasons = dedupeReviewReasons(
    state.blockingErrors.map(getReadableBackendReason),
  );
  const warningReasons = dedupeReviewReasons(
    state.warnings.map(getReadableBackendReason),
  );
  const dispatchVisible =
    state.reviewReady || state.status === "ready" || state.status === "running";
  const dispatchEnabled = state.reviewReady && state.allowedToSend && !isDispatching;
  const dispatchBlockedReason =
    !state.reviewReady
      ? "Completa la review finale prima di aprire il flusso di invio."
      : state.allowedToSend
        ? null
        : dedupeReviewReasons(
            [...state.blockingErrors, ...state.warnings].map(getReadableBackendReason),
          )[0]?.label ?? "Il backend mantiene l'invio reale bloccato in questo ambiente.";
  const blockingContent =
    blockingReasons.length > 0 ? (
      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <div>
          <strong style={{ color: "#0f172a" }}>Problemi da risolvere</strong>
        </div>
        <ul className="admin-record-row__note" style={{ margin: 0 }}>
          {blockingReasons.map((reason) => (
            <li key={`${reason.raw}-${reason.label}`}>
              {reason.label}
            </li>
          ))}
        </ul>
      </div>
    ) : reviewExecuted ? (
      <p className="admin-record-row__note" style={{ marginTop: 18 }}>
        Nessun problema bloccante rilevato dalla verifica.
      </p>
    ) : null;
  const warningContent =
    warningReasons.length > 0 ? (
      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <div>
          <strong style={{ color: "#0f172a" }}>Controlli utili</strong>
        </div>
        <ul className="admin-record-row__note" style={{ margin: 0 }}>
          {warningReasons.map((reason) => (
            <li key={`${reason.raw}-${reason.label}`}>
              {reason.label}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

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
      setDispatchResult(null);
      setDispatchError(null);
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
        setDispatchResult(null);
        setDispatchError(null);
        router.refresh();
      } catch (error) {
        setFormError(getSafeReviewErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    })();
  }, [autoRun, campaign.campaignId, campaign.reviewReady, getToken, router]);

  async function handleDispatchConfirm() {
    if (!dispatchEnabled) {
      return;
    }

    setIsDispatching(true);
    setDispatchError(null);

    try {
      const token = await getToken();
      const result = await sendAdminCampaign(campaign.campaignId, token);
      setDispatchResult(result);
      setIsConfirmModalOpen(false);
      router.refresh();
    } catch (error) {
      setDispatchError(getSafeReviewErrorMessage(error));
    } finally {
      setIsDispatching(false);
    }
  }

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
          label={reviewState.badgeLabel}
          variant={reviewState.badgeVariant}
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
          Verifica in corso...
        </p>
      ) : null}

      <div className="campaign-callout campaign-callout--review" style={{ marginTop: 18 }}>
        <strong style={{ color: "#0f172a" }}>{reviewState.summaryLabel}</strong>
        <p className="campaign-field__helper" style={{ margin: 0 }}>
          {reviewState.helperText}
        </p>
      </div>

      <div className="campaign-review-overview" style={{ marginTop: 18 }}>
        <article className="campaign-review-overview__item">
          <span className="campaign-review-overview__label">Stato attuale</span>
          <strong>{getCampaignStatusLabel(state.status)}</strong>
        </article>
        <article className="campaign-review-overview__item">
          <span className="campaign-review-overview__label">Idonei</span>
          <strong>{state.eligibleContactCount.toLocaleString("it-IT")}</strong>
        </article>
        <article className="campaign-review-overview__item">
          <span className="campaign-review-overview__label">Bloccati</span>
          <strong>{state.blockedContactCount.toLocaleString("it-IT")}</strong>
        </article>
        <article className="campaign-review-overview__item">
          <span className="campaign-review-overview__label">Step attuale</span>
          <strong>{getCampaignStepLabel(state.currentStep)}</strong>
        </article>
        <article className="campaign-review-overview__item">
          <span className="campaign-review-overview__label">Invii oggi</span>
          <strong>
            {(reviewResult?.dailyUsed ?? summary?.dailyUsed ?? 0).toLocaleString("it-IT")} /{" "}
            {(
              reviewResult?.dailyLimit ??
              summary?.dailyLimit ??
              campaign.dailyEmailLimit
            ).toLocaleString("it-IT")}
          </strong>
        </article>
        <article className="campaign-review-overview__item">
          <span className="campaign-review-overview__label">Invii periodo</span>
          <strong>
            {(reviewResult?.periodUsed ?? summary?.periodUsed ?? 0).toLocaleString("it-IT")} /{" "}
            {(
              reviewResult?.periodLimit ??
              summary?.periodLimit ??
              campaign.periodEmailLimit
            ).toLocaleString("it-IT")}
          </strong>
        </article>
      </div>

      <p className="admin-record-row__note" style={{ marginTop: 12 }}>
        {reviewResult?.periodStartedAt ?? summary?.periodStartedAt
          ? `Periodo avviato ${new Intl.DateTimeFormat("it-IT", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date((reviewResult?.periodStartedAt ?? summary?.periodStartedAt)!))}`
          : "Periodo non ancora avviato"}
      </p>

      <div className="campaign-review-checklist" style={{ marginTop: 18 }}>
        {checklistItems.map((item) => {
          const Icon = getChecklistStateIcon(item.state);

          return (
            <article
              key={item.id}
              className="campaign-review-checklist__item"
              data-state={item.state}
            >
              <div className="campaign-review-checklist__header">
                <strong className="campaign-review-checklist__title">
                  <Icon aria-hidden="true" size={18} /> {item.label}
                </strong>
                <span className="campaign-review-checklist__badge">
                  {getChecklistStateLabel(item.state)}
                </span>
              </div>
              <p className="campaign-review-checklist__reason">{item.reason}</p>
              <p className="campaign-review-checklist__action">
                <span>Prossima azione:</span> {item.nextAction}
              </p>
            </article>
          );
        })}
      </div>

      {blockingContent}

      {warningContent}

      {dispatchVisible ? (
        <div className="campaign-callout" style={{ marginTop: 18 }}>
          <strong style={{ color: "#0f172a" }}>Invio controllato</strong>
          <p className="campaign-field__helper" style={{ margin: 0 }}>
            L&apos;invio resta separato dalla review e usa sempre i gate backend esistenti.
          </p>
          <p className="admin-record-row__note" style={{ marginTop: 12 }}>
            {dispatchBlockedReason ??
              "La campagna risulta pronta anche per il gate di invio reale di questo ambiente."}
          </p>
          <div className="campaign-action-row" style={{ marginTop: 16 }}>
            <Button
              type="button"
              className="admin-topbar-action campaign-action campaign-action--primary"
              disabled={!dispatchEnabled}
              onClick={() => {
                setDispatchError(null);
                setIsConfirmModalOpen(true);
              }}
              style={{ minWidth: 190 }}
            >
              {isDispatching ? (
                <Loader2 aria-hidden="true" className="admin-topbar-action__icon" />
              ) : (
                <ClipboardCheck aria-hidden="true" className="admin-topbar-action__icon" />
              )}
              {isDispatching ? "Invio..." : "Invia campagna"}
            </Button>
          </div>
          {dispatchError ? (
            <p
              className="admin-clients-feedback admin-clients-feedback--error"
              role="alert"
              style={{ marginTop: 16 }}
            >
              {dispatchError}
            </p>
          ) : null}
          {dispatchResult ? (
            <div className="campaign-review-checklist__item" style={{ marginTop: 16 }}>
              <div className="campaign-review-checklist__header">
                <strong className="campaign-review-checklist__title">
                  {getDispatchOutcomeLabel(dispatchResult)}
                </strong>
                <span className="campaign-review-checklist__badge">
                  {dispatchResult.code}
                </span>
              </div>
              <p className="campaign-review-checklist__reason">
                {getReadableBackendReason(dispatchResult.reason).label}
              </p>
              <p className="campaign-review-checklist__action">
                <span>Esito backend:</span>{" "}
                {dispatchResult.providerDispatched
                  ? "provider coinvolto"
                  : "nessuna dispatch provider eseguita"}
                , {dispatchResult.emailLogsCreated.toLocaleString("it-IT")} log creati.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

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
          {isSubmitting ? "Verifica..." : reviewState.buttonLabel}
        </Button>
      </div>

      {isConfirmModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!isDispatching) {
              setIsConfirmModalOpen(false);
            }
          }}
        >
          <div
            className="invite-modal campaign-contact-remove-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-dispatch-title"
            aria-describedby="campaign-dispatch-message"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="invite-modal__header">
              <div>
                <p className="invite-modal__eyebrow">Invio controllato</p>
                <h3 id="campaign-dispatch-title" className="invite-modal__title">
                  Confermi l&apos;avvio dell&apos;invio?
                </h3>
              </div>
            </div>
            <p id="campaign-dispatch-message" className="invite-modal__message">
              Il backend rieseguirà i controlli di sicurezza prima di qualsiasi dispatch provider.
            </p>
            <div className="invite-modal__actions" style={{ marginTop: 18 }}>
              <button
                type="button"
                className="invite-modal__button invite-modal__button--secondary"
                disabled={isDispatching}
                onClick={() => setIsConfirmModalOpen(false)}
              >
                Annulla
              </button>
              <button
                type="button"
                className="invite-modal__button invite-modal__button--primary"
                disabled={isDispatching}
                onClick={handleDispatchConfirm}
              >
                {isDispatching ? "Invio..." : "Conferma invio"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
