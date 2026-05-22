"use client";

import { useAuth } from "@clerk/nextjs";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Loader2,
  SendHorizonal,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
  CampaignStatus,
} from "../../types";
import {
  dedupeReviewReasons,
  getCampaignDispatchUiMeta,
  getCampaignReviewStateMeta,
  getCampaignStatusLabel,
  getReadableBackendReason,
  hasDuplicateDispatchBlock,
  isDuplicateDispatchCode,
} from "../shared/campaignUi";
import { formatDateTimeInRome } from "../shared/dateTime";
import { Button } from "../ui/button";
import { StatusBadge } from "../ui/StatusBadge";

interface AdminCampaignReviewPanelProps {
  campaign: AdminCampaignDetail;
  summary: AdminCampaignReadinessSummary | null;
  errorMessage?: string | null;
  autoRun?: boolean;
  mode?: "review" | "send";
  onBack?: () => void;
  onContinue?: () => void;
}

type ChecklistState = "passed" | "warning" | "failed";

interface ReviewChecklistItem {
  id: string;
  label: string;
  state: ChecklistState;
  reason: string;
  nextAction: string;
}

function getSafeReviewErrorMessage(error: unknown, action: "review" | "send"): string {
  if (isApiConfigurationError(error)) {
    return "Configurazione API non valida per questo ambiente.";
  }

  if (isApiError(error)) {
    if (error.isNetworkError) {
      return action === "send"
        ? "Il browser non riesce a raggiungere il backend Sendwise per avviare l'invio."
        : "Il browser non riesce a completare la verifica in questo momento.";
    }

    if (error.status === 401 || error.status === 403) {
      return action === "send"
        ? "La sessione admin non e valida per avviare l'invio."
        : "La sessione admin non e valida per eseguire la verifica.";
    }

    if (error.status === 404) {
      return "Campagna non trovata o non disponibile per questa sessione admin.";
    }

    if (error.status === 409) {
      return action === "send"
        ? "Il backend ha rifiutato l'invio per lo stato corrente della campagna."
        : "La verifica non e disponibile con lo stato attuale della campagna.";
    }

    if (error.status === 422) {
      return action === "send"
        ? "La campagna non e pronta per l'invio reale."
        : "Completa i dati mancanti e poi riprova la verifica.";
    }

    if (error.status !== null && error.status >= 500) {
      return action === "send"
        ? "Il backend ha restituito un errore operativo durante l'invio. Riprova tra poco."
        : "Il backend ha restituito un errore durante la verifica. Riprova tra poco.";
    }

    if (error.detail.trim()) {
      return getReadableBackendReason(error.detail).label;
    }
  }

  return action === "send"
    ? "Non e stato possibile avviare l'invio. Riprova."
    : "Non e stato possibile eseguire la verifica. Riprova.";
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
    dailyLimit: summary?.dailyLimit ?? campaign.dailyEmailLimit,
    dailyUsed: summary?.dailyUsed ?? 0,
    periodLimit: summary?.periodLimit ?? campaign.periodEmailLimit,
    periodUsed: summary?.periodUsed ?? 0,
    periodStartedAt: summary?.periodStartedAt ?? campaign.periodStartedAt ?? null,
  };
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

function buildReviewChecklist(state: ReturnType<typeof getInitialState>): ReviewChecklistItem[] {
  const statusLabel = getCampaignStatusLabel(state.status as CampaignStatus);
  const stateCampaignStatusReady = state.status === "ready" || state.status === "running";

  return [
    {
      id: "content",
      label: "Contenuto email",
      state: state.contentReady ? "passed" : "failed",
      reason: state.contentReady
        ? "Oggetto, HTML e preview risultano salvati."
        : "Il contenuto non e ancora completo o salvato.",
      nextAction: state.contentReady ? "Nessuna azione richiesta." : "Completa e salva il contenuto.",
    },
    {
      id: "recipients",
      label: "Destinatari",
      state: state.contactsReady ? "passed" : "failed",
      reason: state.contactsReady
        ? "La campagna ha destinatari associati."
        : "Non ci sono destinatari associati pronti per la review.",
      nextAction: state.contactsReady ? "Nessuna azione richiesta." : "Aggiungi almeno un destinatario.",
    },
    {
      id: "eligibility",
      label: "Idoneita destinatari",
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
            : `${state.eligibleContactCount.toLocaleString("it-IT")} destinatari idonei, nessun bloccato.`,
      nextAction:
        state.eligibleContactCount === 0
          ? "Mantieni almeno un contatto idoneo."
          : state.blockedContactCount > 0
            ? "Rivedi i contatti bloccati prima dell'invio."
            : "Nessuna azione richiesta.",
    },
    {
      id: "status",
      label: "Stato campagna",
      state: state.reviewReady ? "passed" : stateCampaignStatusReady ? "warning" : "failed",
      reason: state.reviewReady
        ? `La review ha portato la campagna in stato ${statusLabel.toLowerCase()}.`
        : `La campagna e in stato ${statusLabel.toLowerCase()}.`,
      nextAction: state.reviewReady
        ? "Prosegui allo step Invio."
        : "Riesegui la review dopo aver corretto i problemi principali.",
    },
    {
      id: "real-send",
      label: "Invio reale",
      state: state.allowedToSend ? "passed" : state.canSendWhenEnabled ? "warning" : "failed",
      reason: state.allowedToSend
        ? "Il backend consentirebbe l'invio reale in questo ambiente."
        : state.canSendWhenEnabled
          ? "La campagna e pronta, ma l'invio reale e disattivato in questo ambiente."
          : "Il backend non consentirebbe ancora l'invio reale.",
      nextAction: state.allowedToSend
        ? "Usa il CTA finale nello step Invio."
        : "Risolvi i blocchi prima di tentare l'invio.",
    },
  ];
}

function buildSendRecap(
  campaign: AdminCampaignDetail,
  summary: AdminCampaignReadinessSummary | null,
  state: ReturnType<typeof getInitialState>,
) {
  return [
    { label: "Campagna", value: campaign.name },
    { label: "Cliente", value: campaign.clientName },
    { label: "Destinatari idonei", value: state.eligibleContactCount.toLocaleString("it-IT") },
    { label: "Destinatari bloccati", value: state.blockedContactCount.toLocaleString("it-IT") },
    {
      label: "Limite giornaliero",
      value: `${state.dailyUsed.toLocaleString("it-IT")} / ${state.dailyLimit.toLocaleString("it-IT")}`,
    },
    {
      label: "Limite 30 giorni",
      value: `${state.periodUsed.toLocaleString("it-IT")} / ${state.periodLimit.toLocaleString("it-IT")}`,
    },
    {
      label: "Provider runtime",
      value: summary?.runtime.providerModeLabel ?? "Non disponibile",
    },
    ...(summary?.runtime.sesLiveValidationStatus
      ? [
          {
            label: "Warmup / validazione",
            value:
              summary.runtime.sesLiveValidationStatus === "pending"
                ? "In corso"
                : summary.runtime.sesLiveValidationStatus,
          },
        ]
      : []),
  ];
}

function getSendStepStatusMeta(
  dispatchEnabled: boolean,
  blockingReasonsCount: number,
  warningReasonsCount: number,
) {
  if (dispatchEnabled) {
    return {
      badge: "Pronta all'invio",
      border: "1px solid rgba(16, 185, 129, 0.24)",
      background: "linear-gradient(135deg, rgba(236, 253, 245, 0.98), rgba(239, 246, 255, 0.98))",
      accent: "#047857",
      title: "Campagna pronta per l'avvio",
    };
  }

  if (blockingReasonsCount > 0) {
    return {
      badge: "Invio bloccato",
      border: "1px solid rgba(248, 113, 113, 0.24)",
      background: "linear-gradient(135deg, rgba(254, 242, 242, 0.98), rgba(255, 247, 237, 0.98))",
      accent: "#b91c1c",
      title: "Blocchi da risolvere prima dell'invio",
    };
  }

  return {
    badge: warningReasonsCount > 0 ? "Verifica finale richiesta" : "Invio in preparazione",
    border: "1px solid rgba(251, 191, 36, 0.24)",
    background: "linear-gradient(135deg, rgba(255, 251, 235, 0.98), rgba(239, 246, 255, 0.98))",
    accent: "#b45309",
    title: "Verifica operativa ancora aperta",
  };
}

export function AdminCampaignReviewPanel({
  campaign,
  summary,
  errorMessage,
  autoRun = false,
  mode = "review",
  onBack,
  onContinue,
}: AdminCampaignReviewPanelProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const autoRequestedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [reviewResult, setReviewResult] = useState<AdminCampaignReviewResult | null>(null);
  const [dispatchResult, setDispatchResult] = useState<AdminCampaignDispatchResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const rawState = reviewResult ?? getInitialState(campaign, summary);
  const state = {
    ...rawState,
    dailyLimit: rawState.dailyLimit ?? campaign.dailyEmailLimit,
    periodLimit: rawState.periodLimit ?? campaign.periodEmailLimit,
    periodStartedAt: rawState.periodStartedAt ?? null,
  };
  const reviewExecuted = reviewResult !== null || campaign.reviewReady;
  const reviewState = getCampaignReviewStateMeta(state.reviewReady, reviewExecuted);
  const checklistItems = buildReviewChecklist(state);
  const blockingReasons = dedupeReviewReasons(state.blockingErrors.map(getReadableBackendReason));
  const warningReasons = dedupeReviewReasons(state.warnings.map(getReadableBackendReason));
  const duplicateDispatchBlocked =
    hasDuplicateDispatchBlock([...state.blockingErrors, ...state.warnings]) ||
    (dispatchResult ? isDuplicateDispatchCode(dispatchResult.code) : false);
  const dispatchEnabled =
    state.reviewReady &&
    state.allowedToSend &&
    !duplicateDispatchBlocked &&
    !isDispatching;
  const dispatchUiMeta = dispatchResult
    ? getCampaignDispatchUiMeta({
        status: dispatchResult.status,
        allowed: dispatchResult.allowed,
        code: dispatchResult.code,
      })
    : null;
  const sendRecap = buildSendRecap(campaign, summary, state);
  const primaryProblem =
    blockingReasons[0]?.label ??
    (warningReasons.length > 0 ? warningReasons[0]?.label : "Nessun blocco principale rilevato.");
  const sendStatusMeta = getSendStepStatusMeta(
    dispatchEnabled,
    blockingReasons.length,
    warningReasons.length,
  );

  const runReview = useCallback(async () => {
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
      setFormError(getSafeReviewErrorMessage(error, "review"));
    } finally {
      setIsSubmitting(false);
    }
  }, [campaign.campaignId, getToken, isSubmitting, router]);

  useEffect(() => {
    if (mode !== "review" || !autoRun || autoRequestedRef.current || campaign.reviewReady) {
      return;
    }

    autoRequestedRef.current = true;
    void runReview();
  }, [autoRun, campaign.reviewReady, mode, runReview]);

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
      router.push(`/admin/campaigns/${campaign.campaignId}`);
      router.refresh();
    } catch (error) {
      setDispatchError(getSafeReviewErrorMessage(error, "send"));
    } finally {
      setIsDispatching(false);
    }
  }

  if (mode === "send") {
    return (
      <section className="admin-clients-card campaign-panel" id="send">
        <div className="admin-clients-card__intro">
          <div>
            <p className="admin-surface__eyebrow">Step 6</p>
            <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
              Invio finale
            </h2>
            <p className="admin-clients-card__description" style={{ marginTop: 8 }}>
              Recap operativo finale. Il CTA di invio esiste solo qui.
            </p>
          </div>
          <StatusBadge
            label={sendStatusMeta.badge}
            variant={dispatchEnabled ? "success" : blockingReasons.length > 0 ? "danger" : "warning"}
          />
        </div>

        {dispatchError ? (
          <p className="admin-clients-feedback admin-clients-feedback--error" role="alert">
            {dispatchError}
          </p>
        ) : null}

        <div
          style={{
            background: sendStatusMeta.background,
            border: sendStatusMeta.border,
            borderRadius: 28,
            display: "grid",
            gap: 14,
            padding: 24,
          }}
        >
          <span
            className="admin-record-row__note"
            style={{ color: sendStatusMeta.accent, letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            Readiness finale
          </span>
          <strong style={{ color: "#0f172a", fontSize: "1.35rem", lineHeight: 1.2 }}>
            {sendStatusMeta.title}
          </strong>
          <p className="campaign-field__helper" style={{ color: "#0f172a", margin: 0 }}>
            {dispatchEnabled
              ? "Sent significa accettata o avviata dal sistema Listmonk, non consegnata."
              : primaryProblem}
          </p>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <article className="campaign-callout" style={{ minHeight: 0 }}>
              <span className="admin-record-row__note">Campagna</span>
              <strong style={{ color: "#0f172a" }}>{campaign.name}</strong>
            </article>
            <article className="campaign-callout" style={{ minHeight: 0 }}>
              <span className="admin-record-row__note">Destinatari idonei</span>
              <strong style={{ color: "#0f172a" }}>
                {state.eligibleContactCount.toLocaleString("it-IT")}
              </strong>
            </article>
            <article className="campaign-callout" style={{ minHeight: 0 }}>
              <span className="admin-record-row__note">Stato runtime</span>
              <strong style={{ color: "#0f172a" }}>
                {summary?.runtime.providerModeLabel ?? "Non disponibile"}
              </strong>
            </article>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            marginTop: 20,
          }}
        >
          {sendRecap
            .filter((item) =>
              !["Campagna", "Cliente", "Destinatari idonei", "Provider runtime"].includes(
                item.label,
              ),
            )
            .map((item) => (
            <article
              key={item.label}
              className="campaign-callout"
              style={{ minHeight: 96 }}
            >
              <span className="admin-record-row__note">{item.label}</span>
              <strong style={{ color: "#0f172a" }}>{item.value}</strong>
            </article>
            ))}
        </div>

        <section
          className="campaign-panel campaign-panel--subtle"
          style={{ display: "grid", gap: 10, marginTop: 20, padding: 18 }}
        >
          <span className="admin-record-row__note">Nota provider / runtime</span>
          <strong style={{ color: "#0f172a" }}>
            {summary?.runtime.providerModeLabel ?? "Runtime non disponibile"}
          </strong>
          <p className="campaign-field__helper" style={{ margin: 0 }}>
            L&apos;invio parte sempre dal backend Sendwise. &quot;Sent&quot; indica che
            Listmonk ha accettato o avviato il dispatch, non la consegna finale.
          </p>
        </section>

        {dispatchResult && dispatchUiMeta ? (
          <div className="campaign-dispatch-result" style={{ marginTop: 20 }}>
            <div className="campaign-dispatch-result__header">
              <div style={{ display: "grid", gap: 4 }}>
                <strong className="campaign-review-checklist__title">{dispatchUiMeta.title}</strong>
                <p className="campaign-review-checklist__reason">{dispatchUiMeta.summary}</p>
              </div>
              <StatusBadge
                label={dispatchUiMeta.badgeLabel}
                variant={dispatchUiMeta.badgeVariant}
              />
            </div>
          </div>
        ) : null}

        <section
          style={{
            border: "1px solid rgba(148, 163, 184, 0.18)",
            borderRadius: 24,
            display: "grid",
            gap: 14,
            marginTop: 24,
            padding: 20,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <span className="admin-record-row__note">Azione finale</span>
            <strong style={{ color: "#0f172a" }}>Avvia il dispatch controllato</strong>
            <p className="campaign-field__helper" style={{ margin: 0 }}>
              Il backend riesegue i controlli di sicurezza prima di inviare la campagna.
            </p>
          </div>
          <div className="campaign-action-row" style={{ marginTop: 0 }}>
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
              disabled={!dispatchEnabled}
              onClick={() => {
                setDispatchError(null);
                setIsConfirmModalOpen(true);
              }}
              style={{ minWidth: 210 }}
            >
              {isDispatching ? (
                <Loader2 aria-hidden="true" className="admin-topbar-action__icon" />
              ) : (
                <SendHorizonal aria-hidden="true" className="admin-topbar-action__icon" />
              )}
              {isDispatching ? "Invio..." : "Invia campagna"}
            </Button>
          </div>
        </section>

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
                Il backend rieseguira tutti i controlli di sicurezza prima del dispatch reale.
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

  return (
    <section className="admin-clients-card campaign-panel" id="review">
      <div className="admin-clients-card__intro">
        <div>
          <p className="admin-surface__eyebrow">Step 5</p>
          <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
            Review finale
          </h2>
        </div>
        <StatusBadge label={reviewState.badgeLabel} variant={reviewState.badgeVariant} />
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
      {isSubmitting ? <p className="admin-clients-feedback">Verifica in corso...</p> : null}

      <div
        style={{
          background: reviewState.badgeVariant === "warning" ? "rgba(255, 247, 237, 0.96)" : "rgba(239, 246, 255, 0.96)",
          border: reviewState.badgeVariant === "warning"
            ? "1px solid rgba(251, 146, 60, 0.22)"
            : "1px solid rgba(96, 165, 250, 0.22)",
          borderRadius: 24,
          display: "grid",
          gap: 10,
          marginTop: 18,
          padding: 20,
        }}
      >
        <span className="campaign-review-overview__label">Campagna non pronta / focus</span>
        <strong style={{ color: "#0f172a" }}>{primaryProblem}</strong>
        <p className="campaign-field__helper" style={{ margin: 0 }}>
          {reviewState.helperText}
        </p>
        {blockingReasons.length > 0 ? (
          <ul className="admin-record-row__note" style={{ margin: 0, paddingLeft: 18 }}>
            {blockingReasons.map((reason) => (
              <li key={`${reason.raw}-${reason.label}`}>{reason.label}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div
        className="campaign-review-overview"
        style={{ gap: 12, marginTop: 18, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}
      >
        {[
          ["Stato", getCampaignStatusLabel(state.status as CampaignStatus)],
          ["Idonei", state.eligibleContactCount.toLocaleString("it-IT")],
          ["Bloccati", state.blockedContactCount.toLocaleString("it-IT")],
          ["Invii oggi", `${state.dailyUsed.toLocaleString("it-IT")} / ${state.dailyLimit.toLocaleString("it-IT")}`],
          ["Invii 30 giorni", `${state.periodUsed.toLocaleString("it-IT")} / ${state.periodLimit.toLocaleString("it-IT")}`],
          [
            "Periodo",
            state.periodStartedAt ? formatDateTimeInRome(state.periodStartedAt) : "Non avviato",
          ],
        ].map(([label, value]) => (
          <article key={label} className="campaign-review-overview__item" style={{ minHeight: 96 }}>
            <span className="campaign-review-overview__label">{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <details className="campaign-panel campaign-panel--subtle" style={{ marginTop: 18, padding: 18 }}>
        <summary
          style={{
            alignItems: "center",
            color: "#0f172a",
            cursor: "pointer",
            display: "flex",
            fontWeight: 700,
            gap: 10,
            listStyle: "none",
          }}
        >
          <ChevronDown aria-hidden="true" size={16} />
          Controlli di readiness compatti
        </summary>
        <div className="campaign-review-checklist" style={{ marginTop: 16 }}>
          {checklistItems.map((item) => {
            const Icon = getChecklistStateIcon(item.state);

            return (
              <article
                key={item.id}
                className="campaign-review-checklist__item"
                data-state={item.state}
                style={{ padding: 16 }}
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
      </details>

      {warningReasons.length > 0 ? (
        <div className="campaign-detail-notes" style={{ marginTop: 18 }}>
          <strong style={{ color: "#0f172a" }}>Controlli utili</strong>
          <ul className="admin-record-row__note" style={{ margin: 0 }}>
            {warningReasons.map((reason) => (
              <li key={`${reason.raw}-${reason.label}`}>{reason.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="campaign-action-row" style={{ marginTop: 24 }}>
        <Button
          type="button"
          variant="outline"
          className="admin-topbar-action campaign-action campaign-action--secondary"
          onClick={onBack}
          style={{ minWidth: 148 }}
        >
          Indietro
        </Button>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
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
          <Button
            type="button"
            variant="outline"
            className="admin-topbar-action campaign-action campaign-action--secondary"
            disabled={!state.reviewReady}
            onClick={onContinue}
            style={{ minWidth: 180 }}
          >
            Vai allo step Invio
          </Button>
        </div>
      </div>
    </section>
  );
}
