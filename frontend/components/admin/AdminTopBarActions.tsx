"use client";

import { useAuth } from "@clerk/nextjs";
import { Download, Mail, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createAdminClientInvite, isApiError } from "../../lib/api";
import { Button } from "../ui/button";

type ToastState =
  | {
      tone: "success" | "error";
      message: string;
    }
  | null;

function getSafeInviteErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.isNetworkError) {
      return "Il browser non riesce a raggiungere il backend Sendwise per inviare l'invito.";
    }

    if (error.status === 409) {
      return "Questa email e gia associata a un accesso cliente attivo o in invito.";
    }

    if (error.status === 422) {
      return error.detail || "Inserisci un indirizzo email valido prima di inviare l'invito.";
    }

    if (error.status === 401 || error.status === 403) {
      return "La sessione admin non e valida per creare un nuovo invito cliente.";
    }

    if (error.detail.trim()) {
      return error.detail;
    }
  }

  return "Non e stato possibile inviare l'invito cliente. Riprova.";
}

export function AdminTopBarActions() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setToast(null);

    try {
      const token = await getToken();
      await createAdminClientInvite(email, token);
      setOpen(false);
      setEmail("");
      setToast({
        tone: "success",
        message: "Invito cliente inviato correttamente.",
      });
      router.refresh();
    } catch (error) {
      setToast({
        tone: "error",
        message: getSafeInviteErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const inviteModal =
    mounted && open
      ? createPortal(
          <div className="modal-backdrop" role="presentation">
            <section
              className="invite-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="invite-modal-title"
            >
              <div className="invite-modal__header">
                <div>
                  <p className="invite-modal__eyebrow">Clienti</p>
                  <h2 id="invite-modal-title" className="invite-modal__title">
                    Nuovo invito cliente
                  </h2>
                </div>
                <button
                  type="button"
                  className="invite-modal__close"
                  aria-label="Chiudi modal"
                  disabled={isSubmitting}
                  onClick={() => setOpen(false)}
                >
                  <X aria-hidden="true" />
                </button>
              </div>

              <p className="invite-modal__message">
                Inserisci solo l&apos;email del cliente. Il completamento profilo
                avverra dopo l&apos;accettazione dell&apos;invito.
              </p>

              <form className="invite-modal__form" onSubmit={handleInviteSubmit}>
                <label className="invite-modal__field" htmlFor="invite-client-email">
                  <span>Email cliente</span>
                  <div className="invite-modal__input-shell">
                    <Mail aria-hidden="true" />
                    <input
                      id="invite-client-email"
                      type="email"
                      autoComplete="email"
                      className="invite-modal__input"
                      disabled={isSubmitting}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="cliente@studio.it"
                      required
                      value={email}
                    />
                  </div>
                </label>

                <div className="invite-modal__actions">
                  <button
                    type="button"
                    className="invite-modal__button invite-modal__button--secondary"
                    disabled={isSubmitting}
                    onClick={() => setOpen(false)}
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="invite-modal__button invite-modal__button--primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Invio in corso..." : "Invia invito"}
                  </button>
                </div>
              </form>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
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

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="admin-topbar-action admin-topbar-action--secondary"
        disabled
      >
        <Download aria-hidden="true" className="admin-topbar-action__icon" />
        Esporta vista
      </Button>

      <Button
        type="button"
        size="lg"
        className="admin-topbar-action admin-topbar-action--primary"
        onClick={() => setOpen(true)}
      >
        <UserPlus aria-hidden="true" className="admin-topbar-action__icon" />
        Aggiungi cliente
      </Button>

      {inviteModal}
    </>
  );
}