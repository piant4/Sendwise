export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  recommendedUseCase: string;
  previewText: string;
  htmlBody: string;
  plainTextBody: string;
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "primo-contatto-commerciale",
    name: "Primo contatto commerciale",
    description: "Primo contatto chiaro e professionale.",
    category: "Commerciale",
    recommendedUseCase: "Quando vuoi avviare una conversazione con un lead o un prospect.",
    previewText:
      "Un primo messaggio essenziale per aprire il dialogo.",
    htmlBody: `<p>Ciao {{nome}},</p>
<p>ti contatto per condividere una proposta essenziale e capire se puo essere utile per il tuo contesto operativo.</p>
<p>Se il tema e rilevante, posso inviarti un riepilogo breve oppure concordare un confronto introduttivo.</p>
<p>Un saluto,<br />Team Sendwise</p>`,
    plainTextBody: `Ciao {{nome}},

ti contatto per condividere una proposta essenziale e capire se puo essere utile per il tuo contesto operativo.

Se il tema e rilevante, posso inviarti un riepilogo breve oppure concordare un confronto introduttivo.

Un saluto,
Team Sendwise`,
  },
  {
    id: "follow-up-leggero",
    name: "Follow-up leggero",
    description: "Follow-up misurato per riprendere il dialogo.",
    category: "Follow-up",
    recommendedUseCase: "Quando hai gia scritto e vuoi riprendere il filo con tono professionale.",
    previewText:
      "Un richiamo cortese per riprendere la conversazione.",
    htmlBody: `<p>Ciao {{nome}},</p>
<p>riprendo il mio messaggio precedente, nel caso sia passato in secondo piano.</p>
<p>Se il tema resta attuale, posso condividere un esempio pratico o un riepilogo molto rapido.</p>
<p>Se invece non e una priorita, nessun problema: mi basta un cenno per allinearmi.</p>
<p>Grazie,<br />Team Sendwise</p>`,
    plainTextBody: `Ciao {{nome}},

riprendo il mio messaggio precedente, nel caso sia passato in secondo piano.

Se il tema resta attuale, posso condividere un esempio pratico o un riepilogo molto rapido.

Se invece non e una priorita, nessun problema: mi basta un cenno per allinearmi.

Grazie,
Team Sendwise`,
  },
  {
    id: "newsletter-breve",
    name: "Newsletter breve",
    description: "Aggiornamento breve con un messaggio centrale.",
    category: "Newsletter",
    recommendedUseCase: "Quando vuoi comunicare una novita o un aggiornamento sintetico.",
    previewText:
      "Un aggiornamento rapido, leggibile in pochi secondi.",
    htmlBody: `<p>Ciao {{nome}},</p>
<p>ti condividiamo un aggiornamento rapido.</p>
<p>In breve:</p>
<ul>
  <li>novita principale</li>
  <li>perche conta adesso</li>
  <li>prossimo passo consigliato</li>
</ul>
<p>Se vuoi approfondire, possiamo inviarti il dettaglio completo o fissare un confronto dedicato.</p>
<p>A presto,<br />Team Sendwise</p>`,
    plainTextBody: `Ciao {{nome}},

ti condividiamo un aggiornamento rapido.

In breve:
- novita principale
- perche conta adesso
- prossimo passo consigliato

Se vuoi approfondire, possiamo inviarti il dettaglio completo o fissare un confronto dedicato.

A presto,
Team Sendwise`,
  },
  {
    id: "annuncio-prodotto",
    name: "Annuncio prodotto",
    description: "Annuncio sintetico per una novita di prodotto.",
    category: "Prodotto",
    recommendedUseCase: "Quando devi presentare una novita con benefici chiari e tono sobrio.",
    previewText:
      "Una novita presentata in modo semplice e diretto.",
    htmlBody: `<p>Ciao {{nome}},</p>
<p>ti segnaliamo una novita pensata per semplificare alcune attivita operative.</p>
<p>Puo essere utile soprattutto se vuoi:</p>
<ul>
  <li>ridurre passaggi manuali</li>
  <li>avere un flusso piu chiaro</li>
  <li>migliorare il controllo operativo</li>
</ul>
<p>Se ti interessa, possiamo condividere una panoramica breve con casi d'uso rilevanti.</p>
<p>Un saluto,<br />Team Sendwise</p>`,
    plainTextBody: `Ciao {{nome}},

ti segnaliamo una novita pensata per semplificare alcune attivita operative.

Puo essere utile soprattutto se vuoi:
- ridurre passaggi manuali
- avere un flusso piu chiaro
- migliorare il controllo operativo

Se ti interessa, possiamo condividere una panoramica breve con casi d'uso rilevanti.

Un saluto,
Team Sendwise`,
  },
  {
    id: "invito-consulenza-demo",
    name: "Invito consulenza/demo",
    description: "Invito breve a un confronto o a una demo.",
    category: "Invito",
    recommendedUseCase: "Quando vuoi proporre una call conoscitiva o una demo mirata.",
    previewText:
      "Un invito diretto a fissare un confronto rapido.",
    htmlBody: `<p>Ciao {{nome}},</p>
<p>se il tema e attuale, possiamo organizzare una breve consulenza o una demo mirata.</p>
<p>L'obiettivo e capire rapidamente se c'e aderenza con il vostro contesto operativo, senza entrare in un percorso complesso.</p>
<p>Se vuoi, posso proporti alcune disponibilita oppure inviarti prima una sintesi scritta.</p>
<p>Grazie per l'attenzione,<br />Team Sendwise</p>`,
    plainTextBody: `Ciao {{nome}},

se il tema e attuale, possiamo organizzare una breve consulenza o una demo mirata.

L'obiettivo e capire rapidamente se c'e aderenza con il vostro contesto operativo, senza entrare in un percorso complesso.

Se vuoi, posso proporti alcune disponibilita oppure inviarti prima una sintesi scritta.

Grazie per l'attenzione,
Team Sendwise`,
  },
];

export function getCampaignTemplateById(templateId: string | null | undefined) {
  if (!templateId) {
    return null;
  }

  return CAMPAIGN_TEMPLATES.find((template) => template.id === templateId) ?? null;
}
