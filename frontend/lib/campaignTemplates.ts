export interface CampaignTemplate {
  id: string;
  clientId?: string | null;
  name: string;
  description: string;
  category: string;
  subject: string;
  recommendedUseCase: string;
  previewText: string;
  htmlBody: string;
  plainTextBody: string;
  source: "builtin" | "saved";
}

interface TemplateCopy {
  eyebrow: string;
  title: string;
  lead: string;
  bullets: string[];
  closing: string;
  ctaLabel: string;
  ctaHref: string;
}

function buildEmailHtml(copy: TemplateCopy): string {
  const bullets = copy.bullets
    .map(
      (bullet) =>
        `<tr><td style="padding:0 0 10px 0;font-size:15px;line-height:24px;color:#334155;"><span style="color:#0f172a;font-weight:700;">•</span> ${bullet}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>{{campaign_name}}</title>
  </head>
  <body style="margin:0;padding:0;background:#e8eef6;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{preview_text}}</div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#e8eef6;margin:0;padding:0;width:100%;">
      <tr>
        <td align="center" style="padding:24px 14px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:640px;width:100%;">
            <tr>
              <td style="padding:0 0 16px 0;text-align:left;">
                <div style="margin-bottom:14px;">{{logo}}</div>
                <p style="margin:0;font-size:12px;line-height:18px;letter-spacing:0.18em;text-transform:uppercase;color:#475569;">${copy.eyebrow}</p>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #d8e1ec;border-radius:28px;padding:32px 28px 24px 28px;">
                <p style="margin:0 0 14px 0;font-size:16px;line-height:24px;color:#334155;">Ciao {{nome}},</p>
                <h1 style="margin:0 0 16px 0;font-size:28px;line-height:34px;font-weight:700;color:#0f172a;">${copy.title}</h1>
                <p style="margin:0 0 22px 0;font-size:16px;line-height:26px;color:#334155;">${copy.lead}</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px 0;">
                  ${bullets}
                </table>
                <div style="margin:0 0 24px 0;padding:18px 20px;border-radius:20px;background:#f8fbff;border:1px solid #dce8f5;">
                  <p style="margin:0 0 10px 0;font-size:13px;line-height:18px;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;">Campagna</p>
                  <p style="margin:0;font-size:17px;line-height:24px;color:#0f172a;font-weight:600;">{{campaign_name}}</p>
                </div>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:24px;color:#334155;">${copy.closing}</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px 0;">
                  <tr>
                    <td align="center" style="border-radius:999px;background:#0f172a;">
                      <a href="${copy.ctaHref}" style="display:inline-block;padding:14px 22px;font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">${copy.ctaLabel}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 6px 0;font-size:15px;line-height:24px;color:#0f172a;font-weight:600;">{{sender_name}}</p>
                <p style="margin:0;font-size:14px;line-height:22px;color:#64748b;">{{company_name}}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 10px 0 10px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="padding:0 0 12px 0;">{{social_icons}}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 8px 0;font-size:13px;line-height:21px;color:#52606d;">
                      {{company_name}}<br />
                      <a href="{{website_url}}" style="color:#0f172a;text-decoration:underline;">{{website_url}}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;line-height:20px;color:#52606d;">
                      Ricevi questa email perche sei iscritto agli aggiornamenti di {{company_name}}. Gestisci le preferenze o <a href="{{unsubscribe_url}}" style="color:#0f172a;text-decoration:underline;">disiscriviti</a>.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:8px;font-size:12px;line-height:20px;color:#7b8794;">
                      © {{current_year}} {{company_name}}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildPlainTextBody(copy: TemplateCopy): string {
  const bulletLines = copy.bullets.map((bullet) => `- ${bullet}`).join("\n");

  return `Ciao {{nome}},

${copy.title}

${copy.lead}

${bulletLines}

Campagna: {{campaign_name}}

${copy.closing}

${copy.ctaLabel}: ${copy.ctaHref}

{{sender_name}}
{{company_name}}
{{website_url}}

Gestisci le preferenze o disiscriviti: {{unsubscribe_url}}
© {{current_year}} {{company_name}}`;
}

function buildTemplate(
  base: Omit<CampaignTemplate, "htmlBody" | "plainTextBody">,
  copy: TemplateCopy,
): CampaignTemplate {
  return {
    ...base,
    htmlBody: buildEmailHtml(copy),
    plainTextBody: buildPlainTextBody(copy),
  };
}

export const DEFAULT_CAMPAIGN_TEMPLATE_ID = "primo-contatto-commerciale";

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  buildTemplate(
    {
      id: "primo-contatto-commerciale",
      clientId: null,
      name: "Primo contatto commerciale",
      description: "Apertura credibile con struttura piu solida e footer completo.",
      category: "Commerciale",
      subject: "Una proposta rapida per {{company_name}}",
      recommendedUseCase:
        "Quando vuoi rompere il ghiaccio con un lead mantenendo un tono pulito e professionale.",
      previewText:
        "Una presentazione chiara con valore iniziale, contesto e uscita ordinata.",
      source: "builtin",
    },
    {
      eyebrow: "Primo contatto",
      title: "Una proposta rapida, pensata per il tuo contesto.",
      lead:
        "Ti scriviamo per capire se ha senso aprire un confronto leggero su un tema operativo che stiamo seguendo da vicino.",
      bullets: [
        "individuiamo il punto in cui si crea piu attrito",
        "condividiamo un approccio concreto e poco invasivo",
        "valutiamo insieme se vale la pena approfondire",
      ],
      closing:
        "Se per te il tema e rilevante, possiamo inviarti un riepilogo essenziale oppure proporti un confronto introduttivo.",
      ctaLabel: "Approfondisci il tema",
      ctaHref: "{{website_url}}",
    },
  ),
  buildTemplate(
    {
      id: "follow-up-leggero",
      clientId: null,
      name: "Follow-up leggero",
      description: "Follow-up elegante, con richiamo contestuale e CTA morbida.",
      category: "Follow-up",
      subject: "Riprendiamo il filo su {{campaign_name}}",
      recommendedUseCase:
        "Quando hai gia inviato un primo messaggio e vuoi riaprire il dialogo senza pressione.",
      previewText:
        "Riprendiamo il filo con un follow-up misurato e leggibile anche da mobile.",
      source: "builtin",
    },
    {
      eyebrow: "Follow-up",
      title: "Riprendiamo il filo, senza allungare il processo.",
      lead:
        "Ritorniamo sul messaggio precedente per lasciarti un riferimento piu sintetico e semplice da valutare.",
      bullets: [
        "recuperi in pochi secondi il punto principale",
        "capisci se il timing e corretto per il tuo team",
        "puoi rispondere con un si, un no o un piu avanti",
      ],
      closing:
        "Se non e una priorita adesso nessun problema. Se invece vuoi, possiamo condividere un esempio pratico calibrato sul tuo scenario.",
      ctaLabel: "Richiedi un esempio rapido",
      ctaHref: "{{website_url}}",
    },
  ),
  buildTemplate(
    {
      id: "newsletter-breve",
      clientId: null,
      name: "Newsletter breve",
      description: "Aggiornamento essenziale con gerarchia migliore e footer operativo.",
      category: "Newsletter",
      subject: "Le novita essenziali di {{campaign_name}}",
      recommendedUseCase:
        "Quando devi comunicare una novita sintetica e vuoi una lettura scorrevole su inbox mobile.",
      previewText:
        "Una newsletter breve con priorita evidenti, sezione centrale e chiusura chiara.",
      source: "builtin",
    },
    {
      eyebrow: "Aggiornamento",
      title: "Le novita piu importanti, senza rumore.",
      lead:
        "Abbiamo raccolto in un solo messaggio quello che conta adesso, cosi puoi capire subito impatto e prossimo passo.",
      bullets: [
        "la novita principale da tenere d'occhio",
        "perche cambia qualcosa nel breve periodo",
        "quale azione suggeriamo per partire bene",
      ],
      closing:
        "Se vuoi il dettaglio completo possiamo condividerlo in una seconda mail o in un confronto dedicato.",
      ctaLabel: "Leggi l'aggiornamento completo",
      ctaHref: "{{website_url}}",
    },
  ),
  buildTemplate(
    {
      id: "annuncio-prodotto",
      clientId: null,
      name: "Annuncio prodotto",
      description: "Annuncio piu leggibile con focus sul beneficio e struttura da lancio.",
      category: "Prodotto",
      subject: "Novita prodotto: {{campaign_name}}",
      recommendedUseCase:
        "Quando presenti una novita di prodotto e vuoi guidare lettura, beneficio e azione.",
      previewText:
        "Presentiamo una novita con un layout piu forte, adatto a lanci e release notes essenziali.",
      source: "builtin",
    },
    {
      eyebrow: "Novita prodotto",
      title: "Una novita progettata per semplificare il lavoro operativo.",
      lead:
        "Abbiamo introdotto un aggiornamento pensato per ridurre passaggi inutili e rendere piu chiaro il flusso quotidiano.",
      bullets: [
        "meno lavoro manuale nei passaggi ripetitivi",
        "piu visibilita su stato, contesto e priorita",
        "un onboarding piu semplice per chi entra nel processo",
      ],
      closing:
        "Se vuoi capire rapidamente se puo essere utile per il tuo team, possiamo inviarti una panoramica breve con casi d'uso pertinenti.",
      ctaLabel: "Scopri la novita",
      ctaHref: "{{website_url}}",
    },
  ),
  buildTemplate(
    {
      id: "invito-consulenza-demo",
      clientId: null,
      name: "Invito consulenza/demo",
      description: "Invito piu curato con sezione dedicata alla call-to-action.",
      category: "Invito",
      subject: "Possiamo mostrarti {{campaign_name}} in 20 minuti",
      recommendedUseCase:
        "Quando vuoi proporre una demo o una call breve lasciando chiaro il perimetro del confronto.",
      source: "builtin",
      previewText:
        "Un invito diretto a fissare una consulenza o una demo breve, con tono ordinato e non aggressivo.",
    },
    {
      eyebrow: "Invito",
      title: "Possiamo sentirci in modo rapido e mirato.",
      lead:
        "Se il tema e attuale, possiamo organizzare una breve consulenza o una demo focalizzata solo sui punti utili per te.",
      bullets: [
        "allineiamo obiettivi e vincoli in pochi minuti",
        "vedi un esempio concreto senza entrare in un percorso lungo",
        "decidi subito se ha senso proseguire oppure no",
      ],
      closing:
        "Se preferisci, prima della call possiamo mandarti una sintesi scritta cosi arrivi al confronto con il contesto gia chiaro.",
      ctaLabel: "Richiedi una demo",
      ctaHref: "{{website_url}}",
    },
  ),
];

export function getCampaignTemplateById(templateId: string | null | undefined) {
  if (!templateId) {
    return null;
  }

  return CAMPAIGN_TEMPLATES.find((template) => template.id === templateId) ?? null;
}
