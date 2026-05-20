import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AdminBlockedSendsList } from "../../../components/admin/AdminBlockedSendsList";
import { AdminSurface } from "../../../components/admin/AdminSurface";
import { formatDateInRome } from "../../../components/shared/dateTime";
import { buildPageMetadata } from "../../../components/shared/metadata";
import {
  getAdminBlockedSends,
  isApiError,
} from "../../../lib/api";

export const dynamic = "force-dynamic";
export const metadata = buildPageMetadata("Dashboard Admin");

export default async function AdminBlockedSendsPage() {
  const { getToken } = await auth();
  let result:
    | { items: Awaited<ReturnType<typeof getAdminBlockedSends>> }
    | { errorMessage: string };

  try {
    result = { items: await getAdminBlockedSends(await getToken()) };
  } catch (error) {
    if (isApiError(error) && [401, 403].includes(error.status ?? 0)) {
      redirect("/auth/redirect");
    }

    result = {
      errorMessage:
        error instanceof Error
          ? error.message
          : "Impossibile caricare gli invii bloccati admin.",
    };
  }

  const items = "items" in result ? result.items : [];
  const affectedClients = new Set(items.map((item) => item.clientId)).size;
  const affectedCampaigns = new Set(
    items.map((item) => item.campaignId).filter(Boolean),
  ).size;

  return (
    <main className="shell">
      <section className="admin-page-shell">
        <header className="admin-page-header">
          <div>
            <p className="admin-surface__eyebrow">Admin</p>
            <h1 className="admin-page-title">Invii bloccati</h1>
            <p className="admin-page-description">
              Vista cross-client letta da `blocked_sends`, con motivazioni e decisioni
              restituite dal backend senza fixture in memoria.
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
            <section className="admin-page-stat-grid" aria-label="Statistiche invii bloccati">
              {[
                { label: "Record totali", value: items.length },
                { label: "Clienti coinvolti", value: affectedClients },
                { label: "Campagne coinvolte", value: affectedCampaigns },
                {
                  label: "Ultimo evento",
                  value: items[0] ? formatDateInRome(items[0].createdAt) : "—",
                },
              ].map((stat) => (
                <article key={stat.label} className="admin-page-stat-card">
                  <span>{stat.label}</span>
                  <strong>{String(stat.value)}</strong>
                </article>
              ))}
            </section>

            <AdminSurface
              title="Timeline bloccante"
              description="Ogni record espone cliente, campagna, motivazione, decisione e timestamp."
              aside={
                <span className="admin-surface__eyebrow">
                  {items.length.toLocaleString()} elementi
                </span>
              }
            >
              {items.length > 0 ? (
                <AdminBlockedSendsList items={items} />
              ) : (
                <div className="admin-empty-state">
                  Nessun invio bloccato presente nel database corrente.
                </div>
              )}
            </AdminSurface>
          </>
        )}
      </section>
    </main>
  );
}
