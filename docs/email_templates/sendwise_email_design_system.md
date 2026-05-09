# Sendwise Email Design System

## Obiettivo

Questo sistema definisce il linguaggio visivo per le email transazionali Clerk di Sendwise.

Le email devono sembrare parte del prodotto Sendwise:

- operative
- affidabili
- premium ma sobrie
- compatte
- orientate alla sicurezza

Non devono sembrare:

- template di default Clerk
- newsletter
- email marketing
- UI infantile o eccessivamente arrotondata
- dark card generica senza identita'

## Principi di design

1. Usare un impianto scuro, tecnico e controllato.
2. Ridurre il rumore visivo: niente glow, niente gradienti vistosi, niente box decorativi.
3. Dare priorita' alla leggibilita': testo chiaro, contrasto alto, gerarchia netta.
4. Trattare CTA e codice come elementi funzionali, non promozionali.
5. Mantenere spaziatura compatta ma respirabile.
6. Fare sembrare l'email una notifica di accesso prodotto, non una campagna.

## Relazione con il design system Sendwise

Il frontend Sendwise usa una palette olive/mint molto controllata e un tono "technical SaaS / operational control panel".
Per Clerk email, la resa migliore e' una variante dark premium che conserva quel carattere operativo ma con contrasto piu' alto, piu' adatto agli email client.

Questo significa:

- fondali scuri freddi
- superfici nette con bordo sottile
- testo chiaro quasi bianco
- accento mint/blue/viola usato solo in micro-dettaglio, se necessario
- CTA chiara ad alto contrasto

## Color tokens

Token principali consigliati:

```txt
page background:     #080B12
surface:             #0D111A
surface elevated:    #111827
border:              #263244
border subtle:       #1F2937
text primary:        #F8FAFC
text secondary:      #CBD5E1
text subtle:         #94A3B8
text muted:          #64748B
cta background:      #F8FAFC
cta text:            #070A0F
accent minimal:      #60A5FA
accent optional alt: #A78BFA
```

Uso consigliato:

- `page background` per il canvas esterno
- `surface` per il contenitore principale
- `surface elevated` per blocchi funzionali integrati come codice o nota operativa
- `border` per il card outline principale
- `border subtle` per divider e linee secondarie
- `text primary` per titolo e contenuti centrali
- `text secondary` per descrizioni
- `text subtle` per label, meta, link fallback
- `text muted` per footer e microcopy
- `cta background` + `cta text` per il bottone principale

## Typography rules

Font stack:

```txt
Arial, Helvetica, sans-serif
```

Regole:

- usare solo font di sistema email-safe
- niente font esterni
- niente serif
- niente text styles decorativi

Gerarchia:

```txt
Meta label:      11-12px, uppercase, bold, tracking leggera
Brand text:      13-14px, semibold
Title:           28-32px, bold
Body:            15-16px, regular
Supporting text: 13-14px, regular
Footer text:     12-13px, regular
Code:            30-36px, bold, letter-spacing ampia
CTA:             14-15px, bold
```

## Spacing rules

Layout:

```txt
Outer width:          560px
Outer horizontal pad: 20-24px
Card padding:         28-32px
Header to card:       18-24px
Title to body:        12-16px
Paragraph gap:        8-12px
CTA block spacing:    20-24px
Footer spacing:       20-24px
```

Regole:

- evitare grandi vuoti verticali
- evitare blocchi troppo stretti
- usare blocchi separati con margini chiari invece di card annidate e rumorose

## Component rules

### Brand row

- centrata
- include `{{> app_logo}}`
- includere anche `{{app.name}}` come testo di supporto
- deve sembrare intestazione prodotto, non hero marketing

### Meta label

- piccola
- uppercase
- colore secondario o subtle
- esempi: `Accesso cliente`, `Verifica account`

### Main card

- una sola card principale
- sfondo `surface`
- bordo 1px sottile
- angoli moderatamente netti
- niente dashed border
- niente ombre pesanti

### CTA

- un solo bottone primario
- pieno, chiaro, ad alto contrasto
- raggio contenuto
- copy breve e diretta

### Info / code section

- integrata nel card
- usare `surface elevated`
- bordo sottile continuo
- niente box tratteggiati
- niente highlight appariscenti

### Footer

- separato da un divider sottile
- tono calmo
- microcopy di sicurezza

## Prohibited patterns

Non usare:

- bordi tratteggiati
- pill enormi e troppo tonde
- gradienti vistosi
- ombre teatrali
- testo a basso contrasto
- box informativi colorati senza motivo
- grandi spazi vuoti
- emoji
- immagini esterne
- classi CSS
- tabelle HTML raw
- script
- font esterni

## Clerk variable notes

Variabili da preservare esattamente:

```txt
{{> app_logo}}
{{app.name}}
{{action_url}}
{{current_year}}
{{invitation.expires_in_days}}
```

Per il template del codice di verifica:

- usare la variabile OTP esistente del template Clerk originale se disponibile
- se non disponibile nel repo o nel dashboard, usare `{{code}}` come placeholder esplicito
- sostituire poi `{{code}}` con la variabile reale esposta da Clerk nel template editor

## Plain text guidance

Le versioni plain text devono:

- mantenere stesso subject
- mantenere stessa CTA come URL completo
- conservare le note di sicurezza
- evitare formattazioni decorative

## Istruzioni di incolla nel dashboard Clerk

1. Apri il template Clerk corretto nel dashboard.
2. Incolla il contenuto `.rehtml` nel campo HTML / visual editor compatibile Clerk.
3. Imposta il subject manualmente nel dashboard:
   - `Invito ad accedere a Sendwise`
   - `Il tuo codice di verifica Sendwise`
4. Incolla la versione plain text corrispondente nel campo testuale.
5. Se il template OTP non usa `{{code}}`, sostituisci il placeholder con la variabile reale di Clerk.
6. Esegui preview da dashboard e verifica:
   - logo renderizzato
   - CTA corretta
   - link fallback visibile
   - contrasto testo
   - nessun tag spezzato

## Checklist manuale prima del paste finale

- tag `<re-*>` bilanciati
- nessuna tabella HTML
- nessuna classe CSS
- nessun asset esterno oltre `{{> app_logo}}`
- copy interamente in italiano
- variabili Clerk preservate
- CTA unica e chiara
- tono coerente con Sendwise B2B SaaS
