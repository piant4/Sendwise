import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AdminCampaignCreateWizard } from "../../../../components/admin/AdminCampaignCreateWizard";
import { getAdminClients, isApiError } from "../../../../lib/api";
import type { Client } from "../../../../types";

export const dynamic = "force-dynamic";

export default async function NewAdminCampaignPage() {
  const { getToken } = await auth();
  let result:
    | {
        clients: Client[];
      }
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
          : "Impossibile caricare i clienti per creare la campagna.",
    };
  }

  return (
    <main className="shell">
      <section className="admin-page-shell">
        <header className="admin-page-header">
          <div>
            <p className="admin-surface__eyebrow">Admin</p>
            <h1 className="admin-page-title">Nuova campagna</h1>
            <p className="admin-page-description">
              Crea una bozza campagna backend-backed. Nessun invio viene avviato.
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
          <AdminCampaignCreateWizard clients={result.clients} />
        )}
      </section>
    </main>
  );
}
