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
  simulateAdminCampaignFollowup,
} from "../../lib/api";
import type {
  AdminCampaignDispatchResult,
  AdminCampaignDetail,
  AdminFollowupSimulationResult,
  AdminCampaignReadinessSummary,
  AdminCampaignReviewResult,
  CampaignStatus,
} from "../../types";
import {
  dedupeReviewReasons,
  getCampaignDispatchUiMeta,
  getCampaignReviewStateMeta,
  getCampaignStatusLabel,
  getProviderHistoryPolicyUiMeta,
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

function getFollowupReasonLabel(reason: string): string {
  switch (reason) {
    case "followup_disabled":
      return "Follow-up disabilitati";
    case "followup_missing_reference_time":
      return "Invio primario non ancora registrato";
    case "followup_delay_not_elapsed":
      return "Ritardo follow-up non ancora trascorso";
    case "followup_daily_limit_exceeded":
      return "Limite giornaliero follow-up raggiunto";
    case "followup_monthly_limit_exceeded":
      return "Limite mensile follow-up raggiunto";
    case "followup_not_delivered":
      return "Primario non consegnato";
    case "followup_already_opened":
      return "Primario gia aperto";
    case "followup_suppressed":
      return "Contatto escluso o disiscritto";
    case "followup_delivery_failed":
      return "Bounce o delivery failure";
    case "followup_complaint":
      return "Reclamo provider";
    case "followup_already_sent":
      return "Follow-up gia registrato";
    default:
      return getReadableBackendReason(reason).label;
  }
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
    followupEnabled: campaign.followupEnabled,
    followupDailyLimit: campaign.followupDailyLimit,
    followupMonthlyLimit: campaign.followupMonthlyLimit,
    followupDelayValue: campaign.followupDelayValue,
    followupDelayUnit: campaign.followupDelayUnit,
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
    {
      label: "Follow-up",
      value: state.followupEnabled
        ? `${(state.followupDailyLimit ?? 0).toLocaleString("it-IT")} / giorno · ${(state.followupMonthlyLimit ?? 0).toLocaleString("it-IT")} / mese`
        : "Disabilitati",
    },
    {
      label: "Ritardo follow-up",
      value: `${state.followupDelayValue.toLocaleString("it-IT")} ${state.followupDelayUnit === "hours" ? "ore" : "giorni"}`,
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
      background: "linear-gradient(135deg, rgba(16, 185, 129, 0.16), var(--sw-accent-soft))",
      accent: "var(--sw-success)",
      title: "Campagna pronta per l'avvio",
    };
  }

  if (blockingReasonsCount > 0) {
    return {
      badge: "Invio bloccato",
      border: "1px solid var(--sw-danger-border)",
      background: "var(--sw-danger-surface)",
      accent: "var(--sw-danger)",
      title: "Blocchi da risolvere prima dell'invio",
    };
  }

  return {
    badge: warningReasonsCount > 0 ? "Verifica finale richiesta" : "Invio in preparazione",
    border: "1px solid var(--sw-warning-border)",
    background: "var(--sw-warning-surface)",
    accent: "var(--sw-warning)",
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
  const [followupResult, setFollowupResult] = useState<AdminFollowupSimulationResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [followupError, setFollowupError] = useState<string | null>(null);
  const [isSimulatingFollowup, setIsSimulatingFollowup] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const rawState = reviewResult ?? getInitialState(campaign, summary);
  const state = {
    ...rawState,
    dailyLimit: rawState.dailyLimit ?? campaign.dailyEmailLimit,
    periodLimit: rawState.periodLimit ?? campaign.periodEmailLimit,
    periodStartedAt: rawState.periodStartedAt ?? null,
    followupEnabled: rawState.followupEnabled ?? campaign.followupEnabled,
    followupDailyLimit: rawState.followupDailyLimit ?? campaign.followupDailyLimit ?? null,
    followupMonthlyLimit: rawState.followupMonthlyLimit ?? campaign.followupMonthlyLimit ?? null,
    followupDelayValue: rawState.followupDelayValue ?? campaign.followupDelayValue,
    followupDelayUnit: rawState.followupDelayUnit ?? campaign.followupDelayUnit,
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
  const providerHistoryPolicy =
    reviewResult?.providerHistory ?? summary?.policyState?.providerHistory ?? [];
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
      setFollowupResult(null);
      setDispatchError(null);
      setFollowupError(null);
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

  async function handleFollowupSimulation() {
    if (isSimulatingFollowup) {
      return;
    }

    setIsSimulatingFollowup(true);
    setFollowupError(null);

    try {
      const token = await getToken();
      const result = await simulateAdminCampaignFollowup(campaign.campaignId, token);
      setFollowupResult(result);
    } catch (error) {
      setFollowupError(getSafeReviewErrorMessage(error, "review"));
    } finally {
      setIsSimulatingFollowup(false);
    }
  }

  if (mode === "send") {
    return (
      <section className="admin-clients-card campaign-panel" id="send">
        <div className="admin-clients-card__intro">
          <div>
            <p className="admin-surface__eyebrow">Step 6</p>
            <h2 className="admin-clients-card__title" style={{ color: "var(--sw-olive)" }}>
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
          <strong style={{ color: "var(--sw-olive)", fontSize: "1.35rem", lineHeight: 1.2 }}>
            {sendStatusMeta.title}
          </strong>
          <p className="campaign-field__helper" style={{ color: "var(--sw-olive)", margin: 0 }}>
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
              <strong style={{ color: "var(--sw-olive)" }}>{campaign.name}</strong>
            </article>
            <article className="campaign-callout" style={{ minHeight: 0 }}>
              <span className="admin-record-row__note">Destinatari idonei</span>
              <strong style={{ color: "var(--sw-olive)" }}>
                {state.eligibleContactCount.toLocaleString("it-IT")}
              </strong>
            </article>
            <article className="campaign-callout" style={{ minHeight: 0 }}>
              <span className="admin-record-row__note">Stato runtime</span>
              <strong style={{ color: "var(--sw-olive)" }}>
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
              <strong style={{ color: "var(--sw-olive)" }}>{item.value}</strong>
            </article>
            ))}
        </div>

        {providerHistoryPolicy.length > 0 ? (
          <section
            className="campaign-panel campaign-panel--subtle"
            style={{ display: "grid", gap: 12, marginTop: 20, padding: 18 }}
          >
            <span className="admin-record-row__note">Deliverability provider</span>
            {providerHistoryPolicy.map((item) => {
              const meta = getProviderHistoryPolicyUiMeta(item);

              return (
                <article
                  key={`${item.code}-${item.metric}-${item.band}`}
                  className="campaign-callout"
                  style={{ minHeight: 0 }}
                >
                  <div className="campaign-review-checklist__header">
                    <strong className="campaign-review-checklist__title">{meta.title}</strong>
                    <StatusBadge label={meta.badgeLabel} variant={meta.badgeVariant} />
                  </div>
                  <p className="campaign-review-checklist__reason">{meta.detail}</p>
                  {meta.rateLabel || meta.domainLabel ? (
                    <p className="admin-record-row__note" style={{ margin: 0 }}>
                      {[meta.rateLabel, meta.domainLabel].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </section>
        ) : null}

        <section
          className="campaign-panel campaign-panel--subtle"
          style={{ display: "grid", gap: 10, marginTop: 20, padding: 18 }}
        >
          <span className="admin-record-row__note">Nota provider / runtime</span>
          <strong style={{ color: "var(--sw-olive)" }}>
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
            border: "1px solid var(--sw-border)",
            borderRadius: 24,
            display: "grid",
            gap: 14,
            marginTop: 24,
            padding: 20,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <span className="admin-record-row__note">Azione finale</span>
            <strong style={{ color: "var(--sw-olive)" }}>Avvia il dispatch controllato</strong>
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
          <h2 className="admin-clients-card__title" style={{ color: "var(--sw-olive)" }}>
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
          background:
            reviewState.badgeVariant === "warning"
              ? "var(--sw-warning-surface)"
              : "var(--sw-accent-soft)",
          border: reviewState.badgeVariant === "warning"
            ? "1px solid var(--sw-warning-border)"
            : "1px solid var(--sw-accent-border-strong)",
          borderRadius: 24,
          display: "grid",
          gap: 10,
          marginTop: 18,
          padding: 20,
        }}
      >
        <span className="campaign-review-overview__label">Campagna non pronta / focus</span>
        <strong style={{ color: "var(--sw-olive)" }}>{primaryProblem}</strong>
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
            "Follow-up",
            state.followupEnabled
              ? `${(state.followupDailyLimit ?? 0).toLocaleString("it-IT")} / giorno · ${(state.followupMonthlyLimit ?? 0).toLocaleString("it-IT")} / mese`
              : "Disabilitati",
          ],
          [
            "Ritardo follow-up",
            `${state.followupDelayValue.toLocaleString("it-IT")} ${state.followupDelayUnit === "hours" ? "ore" : "giorni"}`,
          ],
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
      <p className="campaign-field__helper" style={{ margin: "12px 0 0" }}>
        I follow-up usano limiti separati dagli invii principali.
      </p>

      <section
        className="campaign-panel campaign-panel--subtle"
        style={{ display: "grid", gap: 14, marginTop: 18, padding: 18 }}
      >
        <div className="campaign-review-checklist__header">
          <div style={{ display: "grid", gap: 4 }}>
            <strong className="campaign-review-checklist__title">Simulazione follow-up</strong>
            <p className="campaign-review-checklist__reason">
              {followupResult
                ? "Simulazione completata. Nessun follow-up inviato."
                : "Nessun follow-up inviato."}
            </p>
          </div>
          <StatusBadge
            label={followupResult ? (followupResult.allowed ? "Simulata" : "Bloccata") : "No-send"}
            variant={followupResult?.allowed ? "success" : followupResult ? "warning" : "neutral"}
          />
        </div>

        {followupError ? (
          <p className="admin-clients-feedback admin-clients-feedback--error" role="alert">
            {followupError}
          </p>
        ) : null}

        {followupResult ? (
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            }}
          >
            <article className="campaign-callout" style={{ minHeight: 0 }}>
              <span className="admin-record-row__note">Idonei follow-up</span>
              <strong style={{ color: "var(--sw-olive)" }}>
                {followupResult.eligibleCount.toLocaleString("it-IT")}
              </strong>
            </article>
            <article className="campaign-callout" style={{ minHeight: 0 }}>
              <span className="admin-record-row__note">Bloccati</span>
              <strong style={{ color: "var(--sw-olive)" }}>
                {followupResult.blockedCount.toLocaleString("it-IT")}
              </strong>
            </article>
            <article className="campaign-callout" style={{ minHeight: 0 }}>
              <span className="admin-record-row__note">Primari valutati</span>
              <strong style={{ color: "var(--sw-olive)" }}>
                {followupResult.totalPrimaryRecipientsEvaluated.toLocaleString("it-IT")}
              </strong>
            </article>
          </div>
        ) : null}

        {followupResult && Object.keys(followupResult.blockedReasonCounts).length > 0 ? (
          <div className="campaign-detail-notes">
            <strong style={{ color: "var(--sw-olive)" }}>Motivi principali</strong>
            <ul className="admin-record-row__note" style={{ margin: 0 }}>
              {Object.entries(followupResult.blockedReasonCounts).map(([reason, count]) => (
                <li key={reason}>
                  {getFollowupReasonLabel(reason)}: {count.toLocaleString("it-IT")}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="campaign-field__helper" style={{ margin: 0 }}>
          Il contenuto e l&apos;oggetto dedicati per il follow-up sono ancora necessari.
        </p>
        <div className="campaign-action-row" style={{ marginTop: 0 }}>
          <Button
            type="button"
            variant="outline"
            className="admin-topbar-action campaign-action campaign-action--secondary"
            disabled={!state.followupEnabled || isSimulatingFollowup}
            onClick={handleFollowupSimulation}
            style={{ minWidth: 190 }}
          >
            {isSimulatingFollowup ? (
              <Loader2 aria-hidden="true" className="admin-topbar-action__icon" />
            ) : (
              <ClipboardCheck aria-hidden="true" className="admin-topbar-action__icon" />
            )}
            {isSimulatingFollowup ? "Simulazione..." : "Simula follow-up"}
          </Button>
        </div>
      </section>

      <details className="campaign-panel campaign-panel--subtle" style={{ marginTop: 18, padding: 18 }}>
        <summary
          style={{
            alignItems: "center",
            color: "var(--sw-olive)",
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
          <strong style={{ color: "var(--sw-olive)" }}>Controlli utili</strong>
          <ul className="admin-record-row__note" style={{ margin: 0 }}>
            {warningReasons.map((reason) => (
              <li key={`${reason.raw}-${reason.label}`}>{reason.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {providerHistoryPolicy.length > 0 ? (
        <div className="campaign-detail-notes" style={{ marginTop: 18 }}>
          <strong style={{ color: "var(--sw-olive)" }}>Deliverability provider</strong>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {providerHistoryPolicy.map((item) => {
              const meta = getProviderHistoryPolicyUiMeta(item);

              return (
                <article
                  key={`${item.code}-${item.metric}-${item.band}`}
                  className="campaign-callout"
                  style={{ minHeight: 0 }}
                >
                  <div className="campaign-review-checklist__header">
                    <strong className="campaign-review-checklist__title">{meta.title}</strong>
                    <StatusBadge label={meta.badgeLabel} variant={meta.badgeVariant} />
                  </div>
                  <p className="campaign-review-checklist__reason">{meta.detail}</p>
                  {meta.rateLabel || meta.domainLabel ? (
                    <p className="admin-record-row__note" style={{ margin: 0 }}>
                      {[meta.rateLabel, meta.domainLabel].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
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
