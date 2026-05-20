"use client";

import { useAuth } from "@clerk/nextjs";
import { Archive, Ban, Mail, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  archiveAdminClient,
  isApiError,
  resendAdminClientInvite,
  revokeAdminClientAccess,
} from "../../lib/api";

type ActionName = "resend" | "revoke" | "archive";

type ToastState =
  | {
      tone: "success" | "error";
      message: string;
    }
  | null;

interface AdminClientAccessActionsProps {
  clientId: string;
  clientStatus: string;
  accessStatus?: string | null;
  invitationStatus?: string | null;
}

function getActionErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 404) {
      return "Il record cliente o accesso non e stato trovato.";
    }

    if (error.status === 401 || error.status === 403) {
      return "Solo un admin attivo puo modificare questo accesso cliente.";
    }

    if (error.detail.trim()) {
      return error.detail;
    }
  }

  return "Non e stato possibile completare questa azione cliente.";
}

export function AdminClientAccessActions({
  clientId,
  clientStatus,
  accessStatus,
  invitationStatus,
}: AdminClientAccessActionsProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [confirmAction, setConfirmAction] = useState<ActionName | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionName | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const isPendingInvite =
    accessStatus === "invited" || invitationStatus === "pending";

  const revokeDisabled =
    pendingAction !== null ||
    accessStatus === "suspended" ||
    accessStatus === "archived";
  const resendDisabled = pendingAction !== null || !isPendingInvite;
  const archiveDisabled = pendingAction !== null || clientStatus === "archived";

  async function handleConfirmedAction(action: ActionName) {
    setPendingAction(action);
    setToast(null);

    try {
      const token = await getToken();

      if (action === "resend") {
        await resendAdminClientInvite(clientId, token);
        setToast({
          tone: "success",
          message: "Nuovo invito inviato correttamente.",
        });
      } else if (action === "revoke") {
        await revokeAdminClientAccess(clientId, token);
        setToast({
          tone: "success",
          message: isPendingInvite
            ? "Invito annullato correttamente."
            : "Accesso cliente revocato correttamente.",
        });
      } else {
        await archiveAdminClient(clientId, token);
        setToast({
          tone: "success",
          message: "Cliente archiviato correttamente.",
        });
      }

      setConfirmAction(null);
      router.refresh();
    } catch (error) {
      setToast({
        tone: "error",
        message: getActionErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="admin-client-actions">
      {toast ? (
        <div className={`top-notice top-notice--${toast.tone}`} role="status">
          <span>{toast.message}</span>
          <button
            type="button"
            className="top-notice__dismiss"
            aria-label="Chiudi notifica"
            onClick={() => setToast(null)}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="admin-clients-card">
        <div className="admin-clients-card__intro">
          <div>
            <p className="admin-surface__eyebrow">Accesso</p>
            <h2 className="admin-clients-card__title">Azioni admin</h2>
            <p className="admin-clients-card__description">
              {isPendingInvite
                ? "Finche l'invito e in attesa puoi solo rimandarlo o annullarlo senza mostrare un portale attivo."
                : "Revoca l&apos;accesso al portale o archivia il cliente senza cancellarne lo storico business."}
            </p>
          </div>
        </div>

        <div className="admin-client-actions__buttons">
          {isPendingInvite ? (
            <>
              <button
                type="button"
                className="admin-client-actions__button"
                disabled={resendDisabled}
                onClick={() => handleConfirmedAction("resend")}
              >
                <Send aria-hidden="true" />
                Rimanda invito
              </button>
              <button
                type="button"
                className="admin-client-actions__button admin-client-actions__button--warning"
                disabled={revokeDisabled}
                onClick={() => setConfirmAction("revoke")}
              >
                <Mail aria-hidden="true" />
                Annulla invito
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="admin-client-actions__button admin-client-actions__button--warning"
                disabled={revokeDisabled}
                onClick={() => setConfirmAction("revoke")}
              >
                <Ban aria-hidden="true" />
                Revoca accesso
              </button>
              <button
                type="button"
                className="admin-client-actions__button admin-client-actions__button--danger"
                disabled={archiveDisabled}
                onClick={() => setConfirmAction("archive")}
              >
                <Archive aria-hidden="true" />
                Archivia cliente
              </button>
            </>
          )}
        </div>

        {confirmAction ? (
          <div className="admin-client-actions__confirm" role="alert">
            <strong>
              {confirmAction === "revoke"
                ? "Conferma revoca accesso"
                : "Conferma archiviazione cliente"}
            </strong>
            <span>
              {confirmAction === "revoke"
                ? isPendingInvite
                  ? "L'invito verra annullato e il cliente dovra ricevere un nuovo invito per completare l'attivazione."
                  : "Il cliente non potra piu accedere a /c/{portal_slug} finche l'accesso non verra riattivato manualmente."
                : "Il cliente restera nello storico admin ma non avra piu un accesso portale attivo."}
            </span>
            <div className="admin-client-actions__confirm-buttons">
              <button
                type="button"
                className="admin-client-actions__button admin-client-actions__button--ghost"
                disabled={pendingAction !== null}
                onClick={() => setConfirmAction(null)}
              >
                Annulla
              </button>
              <button
                type="button"
                className="admin-client-actions__button admin-client-actions__button--danger"
                disabled={pendingAction !== null}
                onClick={() => handleConfirmedAction(confirmAction)}
              >
                {pendingAction === confirmAction
                  ? "Aggiornamento in corso..."
                  : confirmAction === "revoke"
                    ? isPendingInvite
                      ? "Conferma annullamento"
                      : "Conferma revoca"
                    : "Conferma archivio"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
