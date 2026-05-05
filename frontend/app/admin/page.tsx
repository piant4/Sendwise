import { getAdminCampaigns, getAdminClients } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [clients, campaigns] = await Promise.all([
    getAdminClients(),
    getAdminCampaigns(),
  ]);

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Milestone 0.5 Stub</p>
        <h1>Admin Boundary</h1>
        <p>Clients: {clients.length}</p>
        <p>Campaigns: {campaigns.length}</p>
      </section>
    </main>
  );
}
