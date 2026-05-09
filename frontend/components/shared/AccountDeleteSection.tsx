"use client";

import { useState, useTransition } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { AlertTriangle, LoaderCircle, ShieldAlert, Trash2 } from "lucide-react";
import type { AuthMeResponse } from "@/lib/api";
import { deleteCurrentAccount, isApiError } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AccountDeleteSectionProps {
  authState: AuthMeResponse | null;
}

const DELETE_CONFIRMATION_TEXT = "ELIMINA";

export function AccountDeleteSection({
  authState,
}: AccountDeleteSectionProps) {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isClientAccount = authState?.access_type === "client";
  const confirmationMatches =
    confirmationText.trim().toUpperCase() === DELETE_CONFIRMATION_TEXT;
  const canDelete = isClientAccount && acknowledged && confirmationMatches && !isPending;

  function handleDelete() {
    if (!canDelete) {
      return;
    }

    setError(null);

    startTransition(() => {
      void (async () => {
        const accessToken = await getToken();

        if (!accessToken) {
          setError("Sessione non disponibile. Riapri la pagina e riprova.");
          return;
        }

        try {
          const response = await deleteCurrentAccount(
            DELETE_CONFIRMATION_TEXT,
            accessToken,
          );

          try {
            await signOut({ redirectUrl: response.redirect_to });
          } catch {
            window.location.assign(response.redirect_to);
          }
        } catch (deleteError) {
          setError(
            isApiError(deleteError)
              ? deleteError.detail
              : "Non e stato possibile eliminare l'account in modo permanente.",
          );
        }
      })();
    });
  }

  if (authState?.access_type === "platform_admin") {
    return (
      <div className="settings-danger settings-danger--blocked">
        <div className="settings-danger__copy">
          <span className="settings-danger__eyebrow">Guardrail admin</span>
          <h3>Eliminazione non disponibile</h3>
          <p>
            Gli account admin non possono autodistruggersi da questa pagina.
          </p>
        </div>
        <ShieldAlert aria-hidden="true" />
      </div>
    );
  }

  if (!isClientAccount) {
    return (
      <div className="settings-danger settings-danger--blocked">
        <div className="settings-danger__copy">
          <span className="settings-danger__eyebrow">Verifica account</span>
          <h3>Eliminazione non disponibile</h3>
          <p>
            Sendwise non riesce a confermare il tipo di account da eliminare.
          </p>
        </div>
        <ShieldAlert aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="settings-danger">
      <div className="settings-danger__header">
        <div className="settings-danger__copy">
          <span className="settings-danger__eyebrow">Zona pericolosa</span>
          <h3>Elimina account definitivamente</h3>
          <p>
            Questa azione rimuove l&apos;account Clerk e i record Sendwise associati.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="settings-danger__toggle"
          onClick={() => {
            setIsExpanded((currentValue) => !currentValue);
            setError(null);
          }}
        >
          <AlertTriangle aria-hidden="true" />
          {isExpanded ? "Chiudi" : "Elimina account"}
        </Button>
      </div>

      {isExpanded ? (
        <div className="settings-danger__confirm">
          <div className="settings-danger__warning">
            <AlertTriangle aria-hidden="true" />
            <p>
              Digita <strong>{DELETE_CONFIRMATION_TEXT}</strong> per confermare la
              cancellazione irreversibile del tuo account client.
            </p>
          </div>

          <div className="settings-danger__form">
            <div className="settings-danger__field">
              <Label htmlFor="account-delete-confirmation">
                Conferma scritta
              </Label>
              <Input
                id="account-delete-confirmation"
                autoCapitalize="characters"
                autoCorrect="off"
                disabled={isPending}
                onChange={(event) => {
                  setConfirmationText(event.target.value);
                }}
                placeholder={DELETE_CONFIRMATION_TEXT}
                value={confirmationText}
              />
            </div>

            <Label className="settings-danger__checkbox">
              <input
                checked={acknowledged}
                disabled={isPending}
                onChange={(event) => {
                  setAcknowledged(event.target.checked);
                }}
                type="checkbox"
              />
              <span>Capisco che questa azione e irreversibile.</span>
            </Label>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Eliminazione non riuscita</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="settings-danger__actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsExpanded(false);
                setConfirmationText("");
                setAcknowledged(false);
                setError(null);
              }}
            >
              Annulla
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="settings-danger__confirm-button"
              disabled={!canDelete}
              onClick={handleDelete}
            >
              {isPending ? (
                <>
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                  Eliminazione...
                </>
              ) : (
                <>
                  <Trash2 aria-hidden="true" />
                  Elimina definitivamente
                </>
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
