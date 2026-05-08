import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminClients, isApiError } from "../../../lib/api";
import type { Client } from "../../../types";

export const dynamic = "force-dynamic";

function formatDateLabel(value?: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function truncatePortalSlug(portalSlug?: string | null): string {
  if (!portalSlug) {
    return "non disponibile";
  }

  if (portalSlug.length <= 18) {
    return portalSlug;
  }

  return `${portalSlug.slice(0, 8)}...${portalSlug.slice(-6)}`;
}

function getClientDisplayName(client: Client): string {
  return client.company_name || client.personal_name || client.name || client.email;
}

function buildClientStats(clients: Client[]) {
  return {
    total: clients.length,
    invitedPending: clients.filter(
      (client) =>
        client.access?.status === "invited" ||
        client.access?.invitation_status === "pending",
    ).length,
    active: clients.filter((client) => client.access?.status === "active").length,
    blocked: clients.filter((client) =>
      ["suspended", "archived"].includes(client.access?.status ?? ""),
    ).length,
  };
}

export default async function AdminClientsPage() {
  const { getToken } = await auth();
  let result:
    | { clients: Client[] }
    | {
        errorMessage: string;
      };

  try {
    result = { clients: await getAdminClients(await getToken()) };
  } catch (error) {
    if (isApiError(error) && [401, 403].includes(error.status ?? 0)) {
      redirect("/auth/redirect");
    }

    result = {
      errorMessage:
        error instanceof Error
          ? error.message
          : "Impossibile caricare il pannello clienti.",
    };
  }
  const stats = "clients" in result ? buildClientStats(result.clients) : null;

  return (
    <main className="shell">
      <section className="admin-clients-control-panel">
        <header className="admin-clients-hero">
          <div>
            <p className="admin-surface__eyebrow">Admin</p>
            <h1 className="admin-clients-hero__title">Clienti</h1>
            <p className="admin-clients-hero__description">
              Gestisci inviti, onboarding, limiti email e stato di accesso dei
              clienti da un unico pannello operativo.
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
            <section className="admin-clients-stats">
              {[
                {
                  label: "Totale clienti",
                  value: stats?.total ?? 0,
                },
                {
                  label: "Invitati o pending",
                  value: stats?.invitedPending ?? 0,
                },
                {
                  label: "Attivi",
                  value: stats?.active ?? 0,
                },
                {
                  label: "Sospesi o archiviati",
                  value: stats?.blocked ?? 0,
                },
              ].map((stat) => (
                <article key={stat.label} className="admin-clients-stat-card">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </article>
              ))}
            </section>
            <section className="admin-clients-card">
              <div className="admin-clients-card__intro">
                <div>
                  <p className="admin-surface__eyebrow">Controllo clienti</p>
                  <h2 className="admin-clients-card__title">Elenco accessi</h2>
                  <p className="admin-clients-card__description">
                    Ogni riga mostra lo stato reale dell&apos;invito, il portale
                    associato e i limiti configurati.
                  </p>
                </div>
              </div>

              {result.clients.length === 0 ? (
                <p className="admin-clients-empty">
                  Nessun cliente registrato ancora.
                </p>
              ) : (
                <div className="admin-clients-table-shell">
                  <div className="admin-clients-table admin-clients-table--header">
                    <span>Cliente</span>
                    <span>Stato accesso</span>
                    <span>Invito</span>
                    <span>Portal slug</span>
                    <span>Limiti email</span>
                    <span>Date</span>
                  </div>

                  <ul className="admin-clients-records">
                    {result.clients.map((client) => (
                      <li key={client.id}>
                        <Link
                          href={`/admin/clients/${client.id}`}
                          className="admin-clients-table admin-clients-table--row"
                        >
                          <div className="admin-clients-cell admin-clients-cell--primary">
                            <strong>{getClientDisplayName(client)}</strong>
                            <span>{client.email}</span>
                            <span>
                              {client.personal_name || "Nome non ancora completato"}
                            </span>
                          </div>

                          <div className="admin-clients-cell">
                            <strong>{client.access?.status ?? "senza accesso"}</strong>
                            <span>Profilo: {client.status}</span>
                          </div>

                          <div className="admin-clients-cell">
                            <strong>
                              {client.access?.invitation_status ?? "non inviato"}
                            </strong>
                            <span>
                              Accettato: {formatDateLabel(client.access?.accepted_at)}
                            </span>
                          </div>

                          <div className="admin-clients-cell">
                            <strong>{truncatePortalSlug(client.access?.portal_slug)}</strong>
                            <span>{client.access?.portal_slug ?? "-"}</span>
                          </div>

                          <div className="admin-clients-cell">
                            <strong>
                              {client.monthly_email_limit ?? "-"} /{" "}
                              {client.daily_email_limit ?? "-"}
                            </strong>
                            <span>Mensile / giornaliero</span>
                          </div>

                          <div className="admin-clients-cell">
                            <strong>
                              Invitato: {formatDateLabel(client.access?.invited_at)}
                            </strong>
                            <span>Creato: {formatDateLabel(client.created_at)}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
