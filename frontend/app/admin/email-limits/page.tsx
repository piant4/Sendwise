import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminSurface } from "../../../components/admin/AdminSurface";
import {
  getAdminEmailLimits,
  isApiError,
  updateAdminClientLimits,
} from "../../../lib/api";
import type { AdminEmailLimitRow, AdminEmailLimitsResponse } from "../../../types";

export const dynamic = "force-dynamic";

interface AdminEmailLimitsPageProps {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    client?: string;
  }>;
}

function formatDateLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getFieldNumber(value: FormDataEntryValue | null): number | null {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return null;
  }

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function getRowStatusLabel(row: AdminEmailLimitRow): string {
  if (row.accessStatus === "active") {
    return "Accesso attivo";
  }

  if (row.accessStatus === "invited") {
    return "Invito in corso";
  }

  if (row.accessStatus === "suspended") {
    return "Accesso sospeso";
  }

  if (row.accessStatus === "archived") {
    return "Accesso archiviato";
  }

  return "Accesso non configurato";
}

async function updateEmailLimitsAction(clientId: string, formData: FormData) {
  "use server";

  try {
    const { getToken } = await auth();
    await updateAdminClientLimits(
      clientId,
      {
        email_limit_per_campaign: getFieldNumber(
          formData.get("email_limit_per_campaign"),
        ),
        max_campaigns: getFieldNumber(formData.get("max_campaigns")),
      },
      await getToken(),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Aggiornamento limiti email non riuscito.";

    redirect(
      `/admin/email-limits?client=${encodeURIComponent(clientId)}&error=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/clients");
  revalidatePath("/admin/email-limits");
  redirect(`/admin/email-limits?saved=${encodeURIComponent(clientId)}`);
}

function buildSummaryCards(data: AdminEmailLimitsResponse) {
  return [
    { label: "Clienti totali", value: data.summary.totalClients },
    { label: "Limiti configurati", value: data.summary.configuredClients },
    { label: "Da completare", value: data.summary.unconfiguredClients },
    {
      label: "Email/campagna aggregate",
      value: data.rows.reduce(
        (total, row) => total + (row.emailLimitPerCampaign ?? 0),
        0,
      ),
    },
  ];
}

export default async function AdminEmailLimitsPage({
  searchParams,
}: AdminEmailLimitsPageProps) {
  const { getToken } = await auth();
  const { saved, error, client } = await searchParams;
  let result:
    | { data: AdminEmailLimitsResponse }
    | {
        errorMessage: string;
      };

  try {
    result = { data: await getAdminEmailLimits(await getToken()) };
  } catch (loadError) {
    if (isApiError(loadError) && [401, 403].includes(loadError.status ?? 0)) {
      redirect("/auth/redirect");
    }

    result = {
      errorMessage:
        loadError instanceof Error
          ? loadError.message
          : "Impossibile caricare la panoramica limiti email.",
    };
  }

  return (
    <main className="shell">
      <section className="admin-page-shell">
        <header className="admin-page-header">
          <div>
            <p className="admin-surface__eyebrow">Admin</p>
            <h1 className="admin-page-title">Limiti email</h1>
            <p className="admin-page-description">
              Modifica i limiti attivi `email_limit_per_campaign` e
              `max_campaigns` per tutti i clienti dal boundary API frontend.
            </p>
          </div>
        </header>

        {"errorMessage" in result ? (
          <section className="admin-clients-card">
            <p className="admin-clients-feedback admin-clients-feedback--error">
              {result.errorMessage}
            </p>
          </section>
        ) : (
          <>
            <section className="admin-page-stat-grid" aria-label="Statistiche limiti email">
              {buildSummaryCards(result.data).map((stat) => (
                <article key={stat.label} className="admin-page-stat-card">
                  <span>{stat.label}</span>
                  <strong>{stat.value.toLocaleString()}</strong>
                </article>
              ))}
            </section>

            <AdminSurface
              title="Controllo limiti per cliente"
              description="Ogni modifica viene validata e persistita nel backend prima del refresh della vista."
              aside={
                <span className="admin-surface__eyebrow">
                  {result.data.rows.length.toLocaleString()} clienti
                </span>
              }
            >
              {result.data.rows.length === 0 ? (
                <div className="admin-empty-state">
                  Nessun cliente disponibile per configurare limiti email.
                </div>
              ) : (
                <div className="admin-record-list">
                  {result.data.rows.map((row) => (
                    <article key={row.clientId} className="admin-record-row">
                      <div className="admin-record-row__primary">
                        <div className="admin-record-row__copy">
                          <strong>{row.clientName}</strong>
                          <span>{row.clientEmail}</span>
                        </div>
                        <span className="admin-record-chip">
                          {getRowStatusLabel(row)}
                        </span>
                      </div>

                      {saved === row.clientId ? (
                        <p className="admin-clients-feedback admin-clients-feedback--success">
                          Limiti aggiornati correttamente.
                        </p>
                      ) : null}

                      {client === row.clientId && error ? (
                        <p className="admin-clients-feedback admin-clients-feedback--error">
                          {decodeURIComponent(error)}
                        </p>
                      ) : null}

                      <dl className="admin-record-grid">
                        <div>
                          <dt>Client ID</dt>
                          <dd>{row.clientId}</dd>
                        </div>
                        <div>
                          <dt>Stato profilo</dt>
                          <dd>{row.clientStatus}</dd>
                        </div>
                        <div>
                          <dt>Stato invito</dt>
                          <dd>{row.invitationStatus || "Non disponibile"}</dd>
                        </div>
                        <div>
                          <dt>Aggiornato</dt>
                          <dd>{formatDateLabel(row.updatedAt)}</dd>
                        </div>
                      </dl>

                      <form
                        action={updateEmailLimitsAction.bind(null, row.clientId)}
                        className="admin-limit-editor"
                      >
                        <label className="admin-limit-editor__field">
                          <span>email_limit_per_campaign</span>
                          <input
                            className="admin-clients-form__input"
                            type="number"
                            name="email_limit_per_campaign"
                            min="0"
                            defaultValue={row.emailLimitPerCampaign ?? ""}
                            placeholder="Es. 5000"
                          />
                        </label>

                        <label className="admin-limit-editor__field">
                          <span>max_campaigns</span>
                          <input
                            className="admin-clients-form__input"
                            type="number"
                            name="max_campaigns"
                            min="0"
                            defaultValue={row.maxCampaigns ?? ""}
                            placeholder="Es. 12"
                          />
                        </label>

                        <button type="submit" className="admin-clients-form__submit">
                          Salva limiti
                        </button>
                      </form>
                    </article>
                  ))}
                </div>
              )}
            </AdminSurface>
          </>
        )}
      </section>
    </main>
  );
}
