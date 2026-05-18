# Clerk Plain Text Templates

## Invitation email

Subject: Invito ad accedere a Sendwise

Preheader: Completa l'accesso al tuo portale Sendwise.

```txt
Sei stato invitato su Sendwise

Un amministratore ti ha invitato ad accedere al tuo portale privato Sendwise.
Accetta l'invito per creare il tuo accesso e completare l'onboarding.

Accetta invito:
{{action_url}}

Questo invito scade tra {{invitation.expires_in_days}} giorni.

Se non aspettavi questo invito, puoi ignorare questa email.

{{app.name}}
(c) {{current_year}}
```

## Verification code email

Subject: Il tuo codice di verifica Sendwise

Preheader: Usa questo codice per continuare su Sendwise.

```txt
Codice di verifica

Inserisci questo codice per continuare su Sendwise.

Codice:
{{code}}

Non condividere questo codice con nessuno.

Se non hai richiesto tu questo accesso, puoi ignorare questa email.

{{app.name}}
(c) {{current_year}}
```

## Nota variabile OTP

Nel repo non e' emerso il nome esatto della variabile Clerk per il codice di verifica.

Al momento i template usano:

```txt
{{code}}
```

Se il dashboard Clerk espone una variabile diversa nel template originale, sostituisci `{{code}}` con quella variabile prima di pubblicare.
