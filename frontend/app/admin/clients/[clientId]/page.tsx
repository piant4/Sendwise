import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminClientAccessActions } from "../../../../components/admin/AdminClientAccessActions";
import { formatDateTimeInRome } from "../../../../components/shared/dateTime";
import { buildPageMetadata } from "../../../../components/shared/metadata";
import {
  getAdminClient,
  isApiError,
  updateAdminClientLimits,
} from "../../../../lib/api";
import type { Client } from "../../../../types";

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
    case "invited":
      return "Accesso invitato";
    case "suspended":
      return "Accesso revocato";
    case "archived":
      return "Accesso archiviato";
    default:
      return "Accesso non configurato";
  }
}

function getInvitationStatusLabel(status?: string | null): string {
  switch (status) {
    case "accepted":
      return "Invito accettato";
    case "pending":
      return "Invito in attesa";
    case "revoked":
      return "Invito revocato";
    case "expired":
      return "Invito scaduto";
    default:
      return "Invito non inviato";
  }
}

async function updateClientLimitsAction(clientId: string, formData: FormData) {
  "use server";

  try {
    const { getToken } = await auth();
    await updateAdminClientLimits(clientId, {
      max_campaigns: getFieldNumber(formData.get("max_campaigns")),
    }, await getToken());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Aggiornamento capacita non riuscito.";
    redirect(
      `/admin/clients/${clientId}?error=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  redirect(`/admin/clients/${clientId}?saved=1`);
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
            Capacita cliente aggiornata correttamente.
          </p>
        ) : null}

        {error ? (
          <p className="admin-clients-feedback admin-clients-feedback--error">
            {decodeURIComponent(error)}
          </p>
        ) : null}

        <section className="admin-client-detail__grid">
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
                <dd>{client.personal_name || "Da completare in onboarding"}</dd>
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
                <h2 className="admin-clients-card__title">Stato invito e portale</h2>
              </div>
            </div>

            <dl className="admin-client-detail__facts">
              <div>
                <dt>Stato accesso</dt>
                <dd>{getAccessStatusLabel(client.access?.status)}</dd>
              </div>
              <div>
                <dt>Stato invito</dt>
                <dd>{getInvitationStatusLabel(client.access?.invitation_status)}</dd>
              </div>
              <div>
                <dt>Portal slug</dt>
                <dd className="admin-client-detail__portal-slug">
                  {client.access?.portal_slug ?? "-"}
                </dd>
              </div>
              <div>
                <dt>Invitato il</dt>
                <dd>{formatDateLabel(client.access?.invited_at)}</dd>
              </div>
              <div>
                <dt>Accettato il</dt>
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
          accessStatus={client.access?.status}
        />
      </section>
    </main>
  );
}
