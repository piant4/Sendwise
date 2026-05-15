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
    description: "Apertura chiara per presentare una proposta iniziale senza tono aggressivo.",
    category: "Commerciale",
    recommendedUseCase: "Quando vuoi avviare una conversazione con un lead o un prospect.",
    previewText:
      "Una proposta iniziale per capire se il tema e rilevante per {{azienda}}.",
    htmlBody: `<p>Ciao {{nome}},</p>
<p>ti contatto perche molte aziende come <strong>{{azienda}}</strong> stanno cercando un modo piu lineare per affrontare <strong>{{problema}}</strong>.</p>
<p>Abbiamo preparato una proposta semplice su <strong>{{proposta}}</strong> che potrebbe aiutarti a valutare il tema senza impegno.</p>
<p>Se per te ha senso, posso inviarti un riepilogo breve o concordare un confronto introduttivo.</p>
<p>Un saluto,<br />Team Sendwise</p>`,
    plainTextBody: `Ciao {{nome}},

ti contatto perche molte aziende come {{azienda}} stanno cercando un modo piu lineare per affrontare {{problema}}.

Abbiamo preparato una proposta semplice su {{proposta}} che potrebbe aiutarti a valutare il tema senza impegno.

Se per te ha senso, posso inviarti un riepilogo breve o concordare un confronto introduttivo.

Un saluto,
Team Sendwise`,
  },
  {
    id: "follow-up-leggero",
    name: "Follow-up leggero",
    description: "Promemoria discreto per riaprire un contatto senza forzare la risposta.",
    category: "Follow-up",
    recommendedUseCase: "Quando hai gia scritto e vuoi riprendere il filo con tono professionale.",
    previewText:
      "Riprendo il messaggio precedente per capire se il tema e ancora utile per {{azienda}}.",
    htmlBody: `<p>Ciao {{nome}},</p>
<p>riprendo il mio messaggio precedente su <strong>{{problema}}</strong>, nel caso sia passato in secondo piano.</p>
<p>Se per <strong>{{azienda}}</strong> questo tema resta attuale, posso condividere un esempio pratico relativo a <strong>{{proposta}}</strong>.</p>
<p>Se invece non e una priorita, nessun problema: mi basta un rapido riscontro per allinearmi.</p>
<p>Grazie,<br />Team Sendwise</p>`,
    plainTextBody: `Ciao {{nome}},

riprendo il mio messaggio precedente su {{problema}}, nel caso sia passato in secondo piano.

Se per {{azienda}} questo tema resta attuale, posso condividere un esempio pratico relativo a {{proposta}}.

Se invece non e una priorita, nessun problema: mi basta un rapido riscontro per allinearmi.

Grazie,
Team Sendwise`,
  },
  {
    id: "newsletter-breve",
    name: "Newsletter breve",
    description: "Formato essenziale per un aggiornamento rapido con un unico messaggio principale.",
    category: "Newsletter",
    recommendedUseCase: "Quando vuoi comunicare una novita o un aggiornamento sintetico.",
    previewText:
      "Un aggiornamento rapido su {{proposta}} pensato per chi segue {{azienda}}.",
    htmlBody: `<p>Ciao {{nome}},</p>
<p>ti condividiamo un aggiornamento rapido su <strong>{{proposta}}</strong>.</p>
<p>In breve:</p>
<ul>
  <li>contesto: {{problema}}</li>
  <li>novita principale: {{proposta}}</li>
  <li>impatto atteso per {{azienda}}: da personalizzare</li>
</ul>
<p>Se vuoi approfondire, possiamo inviarti il dettaglio completo o fissare un confronto dedicato.</p>
<p>A presto,<br />Team Sendwise</p>`,
    plainTextBody: `Ciao {{nome}},

ti condividiamo un aggiornamento rapido su {{proposta}}.

In breve:
- contesto: {{problema}}
- novita principale: {{proposta}}
- impatto atteso per {{azienda}}: da personalizzare

Se vuoi approfondire, possiamo inviarti il dettaglio completo o fissare un confronto dedicato.

A presto,
Team Sendwise`,
  },
  {
    id: "annuncio-prodotto",
    name: "Annuncio prodotto",
    description: "Messaggio strutturato per comunicare un lancio o una nuova funzionalita.",
    category: "Prodotto",
    recommendedUseCase: "Quando devi presentare una novita con benefici chiari e tono sobrio.",
    previewText:
      "Abbiamo preparato un aggiornamento su {{proposta}} che puo interessare {{azienda}}.",
    htmlBody: `<p>Ciao {{nome}},</p>
<p>ti segnaliamo un aggiornamento su <strong>{{proposta}}</strong>, progettato per semplificare attivita legate a <strong>{{problema}}</strong>.</p>
<p>Per <strong>{{azienda}}</strong> puo essere utile soprattutto se vuoi:</p>
<ul>
  <li>ridurre passaggi manuali</li>
  <li>avere un flusso piu chiaro</li>
  <li>migliorare il controllo operativo</li>
</ul>
<p>Se ti interessa, possiamo condividere una panoramica breve con casi d'uso rilevanti.</p>
<p>Un saluto,<br />Team Sendwise</p>`,
    plainTextBody: `Ciao {{nome}},

ti segnaliamo un aggiornamento su {{proposta}}, progettato per semplificare attivita legate a {{problema}}.

Per {{azienda}} puo essere utile soprattutto se vuoi:
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
    description: "Invito misurato a una demo o consulenza, con spazio per contestualizzare il valore.",
    category: "Invito",
    recommendedUseCase: "Quando vuoi proporre una call conoscitiva o una demo mirata.",
    previewText:
      "Possiamo dedicare 20 minuti a un confronto su {{problema}} e {{proposta}}.",
    htmlBody: `<p>Ciao {{nome}},</p>
<p>se il tema <strong>{{problema}}</strong> e attuale per <strong>{{azienda}}</strong>, possiamo organizzare una breve consulenza o demo su <strong>{{proposta}}</strong>.</p>
<p>L'obiettivo e capire rapidamente se c'e aderenza con il vostro contesto operativo, senza entrare in un percorso complesso.</p>
<p>Se vuoi, posso proporti alcune disponibilita oppure inviarti prima una sintesi scritta.</p>
<p>Grazie per l'attenzione,<br />Team Sendwise</p>`,
    plainTextBody: `Ciao {{nome}},

se il tema {{problema}} e attuale per {{azienda}}, possiamo organizzare una breve consulenza o demo su {{proposta}}.

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
