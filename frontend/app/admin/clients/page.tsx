import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Client } from "../../../types";
import {
  createAdminClientInvite,
  getAdminClients,
} from "../../../lib/api";

interface AdminClientsPageProps {
  searchParams: Promise<{
    error?: string;
    invited?: string;
  }>;
}

function getClientLabel(client: Client): string {
  return client.company_name || client.personal_name || client.name || client.email;
}

async function inviteClientAction(formData: FormData) {
  "use server";

  try {
    await createAdminClientInvite({
      email: String(formData.get("email") || ""),
      personal_name: String(formData.get("personal_name") || "").trim() || undefined,
      company_name: String(formData.get("company_name") || "").trim() || undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invito non riuscito.";
    redirect(`/admin/clients?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/clients");
  redirect("/admin/clients?invited=1");
}

export default async function AdminClientsPage({
  searchParams,
}: AdminClientsPageProps) {
  const { error, invited } = await searchParams;
  const clientsResult = await getAdminClients()
    .then((clients) => ({ clients }))
    .catch((loadError: unknown) => ({
      errorMessage:
        loadError instanceof Error
          ? loadError.message
          : "Impossibile caricare i clienti dal backend.",
    }));

  return (
    <main className="shell">
      <section className="admin-clients-page">
        <article className="admin-clients-card">
          <div className="admin-clients-card__intro">
            <div>
              <p className="admin-surface__eyebrow">Admin</p>
              <h1 className="admin-clients-card__title">Clienti</h1>
              <p className="admin-clients-card__description">
                Crea il profilo cliente e invia o reinvia l&apos;invito Clerk
                senza esporre ruoli o registrazione pubblica.
              </p>
            </div>
          </div>

          {invited ? (
            <p className="admin-clients-feedback admin-clients-feedback--success">
              Invito inviato correttamente.
            </p>
          ) : null}

          {error ? (
            <p className="admin-clients-feedback admin-clients-feedback--error">
              {decodeURIComponent(error)}
            </p>
          ) : null}

          <form action={inviteClientAction} className="admin-clients-form">
            <label className="admin-clients-form__field">
              <span>Email cliente</span>
              <input
                className="admin-clients-form__input"
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder="cliente@studio.it"
              />
            </label>
            <label className="admin-clients-form__field">
              <span>Nome persona</span>
              <input
                className="admin-clients-form__input"
                type="text"
                name="personal_name"
                autoComplete="name"
                placeholder="Giulia Rossi"
              />
            </label>
            <label className="admin-clients-form__field">
              <span>Azienda o studio</span>
              <input
                className="admin-clients-form__input"
                type="text"
                name="company_name"
                autoComplete="organization"
                placeholder="Studio Nord"
              />
            </label>
            <button type="submit" className="admin-clients-form__submit">
              Invia invito
            </button>
          </form>
        </article>

        <article className="admin-clients-card">
          <div className="admin-clients-card__intro">
            <div>
              <p className="admin-surface__eyebrow">Elenco</p>
              <h2 className="admin-clients-card__title">Clienti registrati</h2>
              <p className="admin-clients-card__description">
                Vista minima dei profili cliente salvati nel backend business.
              </p>
            </div>
          </div>

          {"errorMessage" in clientsResult ? (
            <p className="admin-clients-feedback admin-clients-feedback--error">
              {clientsResult.errorMessage}
            </p>
          ) : clientsResult.clients.length === 0 ? (
            <p className="admin-clients-empty">
              Nessun cliente registrato ancora.
            </p>
          ) : (
            <ul className="admin-clients-list">
              {clientsResult.clients.map((client) => (
                <li key={client.id} className="admin-clients-list__item">
                  <div>
                    <strong>{getClientLabel(client)}</strong>
                    <span>{client.email}</span>
                  </div>
                  <div>
                    <strong>{client.status}</strong>
                    <span>{client.access?.portal_slug ?? "invito non creato"}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}
