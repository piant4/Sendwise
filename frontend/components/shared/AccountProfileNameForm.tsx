"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useUser } from "@clerk/nextjs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AccountProfileNameFormProps {
  onComplete: () => void;
}

export function AccountProfileNameForm({
  onComplete,
}: AccountProfileNameFormProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [firstNameDraft, setFirstNameDraft] = useState<string | null>(null);
  const [lastNameDraft, setLastNameDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const disabled = !isLoaded || !isSignedIn || !user || isPending;
  const firstName = firstNameDraft ?? user?.firstName ?? "";
  const lastName = lastNameDraft ?? user?.lastName ?? "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      setError("Impossibile caricare il profilo da aggiornare.");
      return;
    }

    const nextFirstName = firstName.trim();
    const nextLastName = lastName.trim();

    if (!nextFirstName && !nextLastName) {
      setError("Inserisci almeno un nome o un cognome.");
      return;
    }

    setError(null);

    startTransition(() => {
      void user
        .update({
          firstName: nextFirstName || null,
          lastName: nextLastName || null,
        })
        .then(() => {
          onComplete();
        })
        .catch(() => {
          setError("Non e stato possibile aggiornare il nome. Riprova.");
        });
    });
  }

  return (
    <form className="account-name-form" onSubmit={handleSubmit}>
      <div className="account-name-form__grid">
        <div className="account-name-form__field">
          <Label htmlFor="account-first-name">Nome</Label>
          <Input
            id="account-first-name"
            autoComplete="given-name"
            disabled={disabled}
            onChange={(event) => {
              setFirstNameDraft(event.target.value);
            }}
            placeholder="Nome"
            value={firstName}
          />
        </div>

        <div className="account-name-form__field">
          <Label htmlFor="account-last-name">Cognome</Label>
          <Input
            id="account-last-name"
            autoComplete="family-name"
            disabled={disabled}
            onChange={(event) => {
              setLastNameDraft(event.target.value);
            }}
            placeholder="Cognome"
            value={lastName}
          />
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Aggiornamento non riuscito</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="account-name-form__actions">
        <Button
          type="button"
          variant="outline"
          onClick={onComplete}
        >
          Annulla
        </Button>
        <Button disabled={disabled} type="submit">
          {isPending ? "Salvataggio..." : "Salva nome"}
        </Button>
      </div>
    </form>
  );
}
