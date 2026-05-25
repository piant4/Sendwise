import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminClientAccessActions } from "../../../../components/admin/AdminClientAccessActions";
import { formatDateTimeInRome } from "../../../../components/shared/dateTime";
import { buildPageMetadata } from "../../../../components/shared/metadata";
import {
  buildClientEmailBrandPayload,
  getBackendAssetUrl,
  getAdminClient,
  isApiError,
  uploadAdminClientBrandLogo,
  updateAdminClientLimits,
} from "../../../../lib/api";
import type { Client, ClientEmailBrand } from "../../../../types";

export const dynamic = "force-dynamic";
export const metadata = buildPageMetadata("Dettaglio cliente");

interface AdminClientDetailPageProps {
  params: Promise<{
    clientId: string;
  }>;
  searchParams: Promise<{
    saved?: string;
    error?: string;
  }>;
}

function formatDateLabel(value?: string | null): string {
  return formatDateTimeInRome(value);
}

function getFieldNumber(value: FormDataEntryValue | null): number | null {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return null;
  }

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function getAccessStatusLabel(status?: string | null): string {
  switch (status) {
    case "active":
      return "Accesso attivo";
    case "suspended":
      return "Accesso disattivato";
    case "archived":
      return "Accesso archiviato";
    case "invited":
      return "Accesso in attivazione";
    default:
      return "Accesso non configurato";
  }
}

function getInvitationStatusLabel(status?: string | null): string {
  switch (status) {
    case "accepted":
      return "Accesso confermato";
    case "pending":
      return "Email accesso inviata";
    case "revoked":
      return "Accesso disattivato";
    case "expired":
      return "Link accesso scaduto";
    default:
      return "Email accesso non inviata";
  }
}

function shouldExposePortalSlug(client: Client): boolean {
  return (
    client.access?.status === "active" &&
    client.access?.invitation_status === "accepted" &&
    Boolean(client.access?.portal_slug)
  );
}

function getActionErrorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) {
    return error.detail;
  }

  return error instanceof Error ? error.message : fallback;
}

async function updateClientLimitsAction(clientId: string, formData: FormData) {
  "use server";

  try {
    const { getToken } = await auth();
    await updateAdminClientLimits(clientId, {
      max_campaigns: getFieldNumber(formData.get("max_campaigns")),
    }, await getToken());
  } catch (error) {
    const message = getActionErrorMessage(
      error,
      "Aggiornamento capacita non riuscito.",
    );
    redirect(
      `/admin/clients/${clientId}?error=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  redirect(`/admin/clients/${clientId}?saved=limits`);
}

function getFieldString(value: FormDataEntryValue | null): string | null {
  const rawValue = String(value ?? "").trim();
  return rawValue || null;
}

function buildBrandPayload(
  formData: FormData,
  logoUrl: string | null,
): ClientEmailBrand {
  return buildClientEmailBrandPayload({
    company_name: getFieldString(formData.get("company_name")),
    sender_name: getFieldString(formData.get("sender_name")),
    website_url: getFieldString(formData.get("website_url")),
    linkedin_url: getFieldString(formData.get("linkedin_url")),
    instagram_url: getFieldString(formData.get("instagram_url")),
    facebook_url: getFieldString(formData.get("facebook_url")),
    x_url: getFieldString(formData.get("x_url")),
    logo_url: logoUrl,
  });
}

async function updateClientBrandAction(clientId: string, formData: FormData) {
  "use server";

  try {
    const { getToken } = await auth();
    const token = await getToken();
    const logoFile = formData.get("logo_file");
    const currentLogoUrl = getFieldString(formData.get("current_logo_url"));
    let logoUrl = currentLogoUrl;

    if (logoFile instanceof File && logoFile.size > 0) {
      const uploadedClient = await uploadAdminClientBrandLogo(clientId, logoFile, token);
      logoUrl = uploadedClient.email_brand?.logo_url ?? null;
    }

    await updateAdminClientLimits(
      clientId,
      {
        email_brand: buildBrandPayload(formData, logoUrl),
      },
      token,
    );
  } catch (error) {
    const message = getActionErrorMessage(
      error,
      "Aggiornamento brand email non riuscito.",
    );
    redirect(
      `/admin/clients/${clientId}?error=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  redirect(`/admin/clients/${clientId}?saved=brand`);
}

export default async function AdminClientDetailPage({
  params,
  searchParams,
}: AdminClientDetailPageProps) {
  const { getToken } = await auth();
  const { clientId } = await params;
  const { saved, error } = await searchParams;
  let result:
    | { client: Client }
    | {
        errorMessage: string;
      };

  try {
    result = { client: await getAdminClient(clientId, await getToken()) };
  } catch (loadError) {
    if (isApiError(loadError) && [401, 403].includes(loadError.status ?? 0)) {
      redirect("/auth/redirect");
    }

    result = {
      errorMessage:
        loadError instanceof Error
          ? loadError.message
          : "Impossibile caricare il dettaglio cliente.",
    };
  }

  if ("errorMessage" in result) {
    return (
      <main className="shell">
        <section className="admin-clients-card">
          <p className="admin-clients-feedback admin-clients-feedback--error">
            {result.errorMessage}
          </p>
        </section>
      </main>
    );
  }

  const { client } = result;
  const showPortalSlug = shouldExposePortalSlug(client);
  const isPendingInvite =
    client.access?.status === "invited" ||
    client.access?.invitation_status === "pending";
  const brand = client.email_brand ?? null;
  const logoPreviewUrl = getBackendAssetUrl(brand?.logo_url);

  return (
    <main className="shell">
      <section className="admin-client-detail">
        <header className="admin-clients-hero">
          <div>
            <p className="admin-surface__eyebrow">Cliente</p>
            <h1 className="admin-clients-hero__title">
              {client.personal_name || client.name || client.email}
            </h1>
            <p className="admin-clients-hero__description">
              Profilo cliente, stato accesso e capacita campagne configurata nel
              backend business.
            </p>
          </div>
        </header>

        {saved ? (
          <p className="admin-clients-feedback admin-clients-feedback--success">
            {saved === "brand"
              ? "Brand email aggiornato correttamente."
              : "Capacita cliente aggiornata correttamente."}
          </p>
        ) : null}

        {error ? (
          <p className="admin-clients-feedback admin-clients-feedback--error">
            {decodeURIComponent(error)}
          </p>
        ) : null}

        <section className="admin-client-detail__grid">
          <article className="admin-clients-card admin-client-brand-card">
            <div className="admin-clients-card__intro">
              <div>
                <p className="admin-surface__eyebrow">Brand email</p>
                <h2 className="admin-clients-card__title">Brand email</h2>
                <p className="admin-clients-card__description">
                  Un solo profilo brand per cliente. Il logo accetta solo file
                  WebP fino a 500 KB; consigliati meno di 200 KB e lato max 1200 px.
                </p>
              </div>
            </div>

            <form
              action={updateClientBrandAction.bind(null, client.id)}
              className="admin-client-brand-card__form"
            >
              <input
                type="hidden"
                name="current_logo_url"
                value={brand?.logo_url ?? ""}
              />

              <div className="admin-client-brand-card__grid">
                <label className="admin-clients-form__field">
                  <span>Ragione sociale</span>
                  <input
                    className="admin-clients-form__input"
                    type="text"
                    name="company_name"
                    defaultValue={brand?.company_name ?? ""}
                    placeholder="Es. Sendwise Studio"
                  />
                </label>

                <label className="admin-clients-form__field">
                  <span>Nome mittente</span>
                  <input
                    className="admin-clients-form__input"
                    type="text"
                    name="sender_name"
                    defaultValue={brand?.sender_name ?? ""}
                    placeholder="Es. Team Sendwise"
                  />
                  <small className="admin-client-brand-card__field-help">
                    Usato come display name del campo From quando supportato. Non controlla
                    la foto profilo mostrata dall&apos;inbox.
                  </small>
                </label>

                <label className="admin-clients-form__field admin-client-brand-card__field--full">
                  <span>Sito web</span>
                  <input
                    className="admin-clients-form__input"
                    type="url"
                    name="website_url"
                    defaultValue={brand?.website_url ?? ""}
                    placeholder="https://example.com"
                  />
                </label>

                <label className="admin-clients-form__field">
                  <span>LinkedIn</span>
                  <input
                    className="admin-clients-form__input"
                    type="url"
                    name="linkedin_url"
                    defaultValue={brand?.linkedin_url ?? ""}
                    placeholder="https://linkedin.com/company/..."
                  />
                </label>

                <label className="admin-clients-form__field">
                  <span>Instagram</span>
                  <input
                    className="admin-clients-form__input"
                    type="url"
                    name="instagram_url"
                    defaultValue={brand?.instagram_url ?? ""}
                    placeholder="https://instagram.com/..."
                  />
                </label>

                <label className="admin-clients-form__field">
                  <span>Facebook</span>
                  <input
                    className="admin-clients-form__input"
                    type="url"
                    name="facebook_url"
                    defaultValue={brand?.facebook_url ?? ""}
                    placeholder="https://facebook.com/..."
                  />
                </label>

                <label className="admin-clients-form__field">
                  <span>X</span>
                  <input
                    className="admin-clients-form__input"
                    type="url"
                    name="x_url"
                    defaultValue={brand?.x_url ?? ""}
                    placeholder="https://x.com/..."
                  />
                </label>
              </div>

              <div className="admin-client-brand-card__logo-row">
                <div className="admin-client-brand-card__logo-copy">
                  <strong>Logo email (.webp)</strong>
                  <span>
                    Carica un file WebP quadrato o con lato massimo 1200 px.
                    Il logo viene mostrato dentro il template email quando configurato.
                    Il backend genera un nome file stabile e ignora il nome originale.
                  </span>
                </div>

                <label className="admin-client-brand-card__upload">
                  <span>Seleziona logo</span>
                  <input
                    type="file"
                    name="logo_file"
                    accept=".webp,image/webp"
                  />
                </label>
              </div>

              {logoPreviewUrl ? (
                <div className="admin-client-brand-card__preview">
                  <Image
                    src={logoPreviewUrl}
                    alt={`Logo brand email di ${client.name}`}
                    className="admin-client-brand-card__preview-image"
                    width={160}
                    height={160}
                    unoptimized
                  />
                  <div className="admin-client-brand-card__preview-copy">
                    <span>Logo email attuale</span>
                    <code>{brand?.logo_url}</code>
                  </div>
                </div>
              ) : (
                <div className="admin-client-detail__placeholder">
                  <strong>Nessun logo caricato</strong>
                  <span>
                    Il renderer usera un logo solo dopo un upload WebP valido.
                  </span>
                </div>
              )}

              <button type="submit" className="admin-clients-form__submit">
                Salva brand email
              </button>
            </form>
          </article>

          <article className="admin-clients-card">
            <div className="admin-clients-card__intro">
              <div>
                <p className="admin-surface__eyebrow">Profilo</p>
                <h2 className="admin-clients-card__title">Anagrafica cliente</h2>
              </div>
            </div>

            <dl className="admin-client-detail__facts">
              <div>
                <dt>Email</dt>
                <dd>{client.email}</dd>
              </div>
              <div>
                <dt>Nome persona</dt>
                <dd>{client.personal_name || "Non impostato"}</dd>
              </div>
              <div>
                <dt>Stato profilo</dt>
                <dd>{client.status}</dd>
              </div>
              <div>
                <dt>Creato</dt>
                <dd>{formatDateLabel(client.created_at)}</dd>
              </div>
              <div>
                <dt>Aggiornato</dt>
                <dd>{formatDateLabel(client.updated_at)}</dd>
              </div>
            </dl>
          </article>

          <article className="admin-clients-card">
            <div className="admin-clients-card__intro">
              <div>
                <p className="admin-surface__eyebrow">Accesso</p>
                <h2 className="admin-clients-card__title">Stato accesso e portale</h2>
              </div>
            </div>

            <dl className="admin-client-detail__facts">
              <div>
                <dt>Stato accesso</dt>
                <dd>{getAccessStatusLabel(client.access?.status)}</dd>
              </div>
              <div>
                <dt>Stato email accesso</dt>
                <dd>{getInvitationStatusLabel(client.access?.invitation_status)}</dd>
              </div>
              <div>
                <dt>Portal slug</dt>
                <dd className="admin-client-detail__portal-slug">
                  {showPortalSlug
                    ? client.access?.portal_slug
                    : isPendingInvite
                      ? "Disponibile dopo il primo accesso completato dal cliente"
                      : "-"}
                </dd>
              </div>
              <div>
                <dt>Email accesso inviata il</dt>
                <dd>{formatDateLabel(client.access?.invited_at)}</dd>
              </div>
              <div>
                <dt>Primo accesso completato il</dt>
                <dd>{formatDateLabel(client.access?.accepted_at)}</dd>
              </div>
              <div>
                <dt>Clerk user id</dt>
                <dd>{client.access?.clerk_user_id ?? "Non ancora associato"}</dd>
              </div>
            </dl>
          </article>
        </section>

        <section className="admin-client-detail__grid">
          <article className="admin-clients-card">
            <div className="admin-clients-card__intro">
              <div>
                <p className="admin-surface__eyebrow">Capacita</p>
                <h2 className="admin-clients-card__title">Capacita account</h2>
                <p className="admin-clients-card__description">
                  Aggiorna solo il numero massimo di campagne attive previsto per
                  questo account cliente.
                </p>
              </div>
            </div>

            <form
              action={updateClientLimitsAction.bind(null, client.id)}
              className="admin-client-detail__limits-form"
            >
              <label className="admin-clients-form__field">
                <span>Numero massimo campagne attive</span>
                <input
                  className="admin-clients-form__input"
                  type="number"
                  name="max_campaigns"
                  min="0"
                  defaultValue={client.max_campaigns ?? ""}
                  placeholder="Es. 12"
                />
              </label>

              <button type="submit" className="admin-clients-form__submit">
                Salva capacita
              </button>
            </form>
          </article>

          <article className="admin-clients-card">
            <div className="admin-clients-card__intro">
              <div>
                <p className="admin-surface__eyebrow">Attivita</p>
                <h2 className="admin-clients-card__title">
                  Campagne, utilizzo e invii bloccati
                </h2>
                <p className="admin-clients-card__description">
                  I dati di dettaglio non sono ancora esposti dagli endpoint
                  backend disponibili in questa milestone.
                </p>
              </div>
            </div>

            <div className="admin-client-detail__placeholder">
              <strong>Dati non disponibili</strong>
              <span>
                Campagne, usage e blocked sends cliente non sono ancora esposti
                da endpoint backend dedicati. La vista mostra solo placeholder
                onesti finche quei dati non esistono davvero.
              </span>
            </div>
          </article>
        </section>

        <AdminClientAccessActions
          clientId={client.id}
          clientStatus={client.status}
          clientEmail={client.email}
          accessStatus={client.access?.status}
          invitationStatus={client.access?.invitation_status}
        />
      </section>
    </main>
  );
}
