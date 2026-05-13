import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AdminSurface } from "../../../components/admin/AdminSurface";
import { AdminSystemHealthPanel } from "../../../components/admin/AdminSystemHealthPanel";
import { getAdminSystemStatus, isApiError } from "../../../lib/api";

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  const { getToken } = await auth();
  let result:
    | { system: Awaited<ReturnType<typeof getAdminSystemStatus>> }
    | { errorMessage: string };

  try {
    result = { system: await getAdminSystemStatus(await getToken()) };
  } catch (error) {
    if (isApiError(error) && [401, 403].includes(error.status ?? 0)) {
      redirect("/auth/redirect");
    }

    result = {
      errorMessage:
        error instanceof Error
          ? error.message
          : "Impossibile caricare lo stato sistema admin.",
    };
  }

  const system = "system" in result ? result.system : null;

  return (
    <main className="shell">
      <section className="admin-page-shell">
        <header className="admin-page-header">
          <div>
            <p className="admin-surface__eyebrow">Admin</p>
            <h1 className="admin-page-title">Sistema</h1>
            <p className="admin-page-description">
              Health operativa e flag di configurazione esposti dal backend in forma
              sicura, senza valori raw di env o segreti applicativi.
            </p>
          </div>
        </header>

        {"errorMessage" in result ? (
          <section className="admin-clients-card">
            <p className="admin-clients-feedback admin-clients-feedback--error">
              {result.errorMessage}
            </p>
          </section>
        ) : system ? (
          <>
            <section className="admin-page-stat-grid" aria-label="Statistiche stato sistema">
              {[
                { label: "Backend", value: system.apiStatus.toUpperCase() },
                { label: "Database", value: system.dbStatus.toUpperCase() },
                {
                  label: "Invio email",
                  value: system.providerModeLabel,
                },
                { label: "Ambiente", value: system.environment.toUpperCase() },
              ].map((stat) => (
                <article key={stat.label} className="admin-page-stat-card">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </article>
              ))}
            </section>

            <AdminSurface
              title="Stato operativo sicuro"
              description="Solo boolean e label sicure: nessuna chiave privata, URL database o output raw dell'ambiente."
            >
              <AdminSystemHealthPanel status={system} />
            </AdminSurface>
          </>
        ) : null}
      </section>
    </main>
  );
}
