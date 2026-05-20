"use client";

import { useAuth } from "@clerk/nextjs";
import { Ban, Mail, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  getAdminClientAccessErrorMessage,
  isApiError,
  resendAdminClientAccessEmail,
  revokeAdminClientAccess,
  sendAdminClientAccessEmail,
} from "../../lib/api";

type ActionName = "send" | "resend" | "revoke";

type ToastState =
  | {
      tone: "success" | "error";
      message: string;
    }
  | null;

interface AdminClientAccessActionsProps {
  clientId: string;
  clientStatus: string;
  clientEmail?: string | null;
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

    const knownMessage = getAdminClientAccessErrorMessage(error);
    if (knownMessage) {
      return knownMessage;
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
  clientEmail,
  accessStatus,
  invitationStatus,
}: AdminClientAccessActionsProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [confirmAction, setConfirmAction] = useState<ActionName | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionName | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const accessConfigured = Boolean(accessStatus);
  const accessEnabled = accessStatus === "active";
  const accessPendingActivation = accessEnabled && invitationStatus !== "accepted";
  const accessDisabled = accessStatus === "suspended";
  const sendDisabled =
    pendingAction !== null || !clientEmail || clientStatus === "archived";
  const resendDisabled = pendingAction !== null || !accessConfigured || !accessEnabled;
  const revokeDisabled =
    pendingAction !== null || !accessConfigured || accessDisabled || clientStatus === "archived";

  async function handleConfirmedAction(action: ActionName) {
    setPendingAction(action);
    setToast(null);

    try {
      const token = await getToken();

      if (action === "resend") {
        await resendAdminClientAccessEmail(clientId, token);
        setToast({
          tone: "success",
          message: "Email accesso inviata nuovamente.",
        });
      } else if (action === "send") {
        await sendAdminClientAccessEmail({ email: clientEmail ?? "" }, token);
        setToast({
          tone: "success",
          message: "Email accesso inviata correttamente.",
        });
      } else if (action === "revoke") {
        await revokeAdminClientAccess(clientId, token);
        setToast({
          tone: "success",
          message: "Accesso cliente disattivato correttamente.",
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
              {accessPendingActivation
                ? "L'accesso cliente e attivo ma il primo ingresso non e ancora stato completato. Puoi rimandare l'email sicura o disattivare l'accesso."
                : accessDisabled || !accessConfigured
                  ? "Invia una nuova email di accesso per riattivare il cliente con un link Clerk sicuro."
                  : "Rimanda l'email di accesso o disattiva il portale cliente senza toccare lo storico business."}
            </p>
          </div>
        </div>

        <div className="admin-client-actions__buttons">
          {accessDisabled || !accessConfigured ? (
            <button
              type="button"
              className="admin-client-actions__button"
              disabled={sendDisabled}
              onClick={() => handleConfirmedAction("send")}
            >
              <Mail aria-hidden="true" />
              Invia email accesso
            </button>
          ) : null}

          {accessConfigured ? (
            <button
              type="button"
              className="admin-client-actions__button"
              disabled={resendDisabled}
              onClick={() => handleConfirmedAction("resend")}
            >
              <Send aria-hidden="true" />
              Rimanda email accesso
            </button>
          ) : null}

          {accessConfigured ? (
            <button
              type="button"
              className="admin-client-actions__button admin-client-actions__button--warning"
              disabled={revokeDisabled}
              onClick={() => setConfirmAction("revoke")}
            >
              <Ban aria-hidden="true" />
              Disattiva accesso
            </button>
          ) : null}
        </div>

        {confirmAction ? (
          <div className="admin-client-actions__confirm" role="alert">
            <strong>
              Conferma disattivazione accesso
            </strong>
            <span>
              Il cliente non potra piu accedere al portale finche un admin non inviera una nuova email di accesso.
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
                  : "Conferma disattivazione"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
