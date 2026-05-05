import { getMockAdminCampaigns, getMockAdminClients } from "../../lib/mock-api";

export default function AdminPage() {
  const clients = getMockAdminClients();
  const campaigns = getMockAdminCampaigns();

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">V1 Skeleton</p>
        <h1>Admin Dashboard Placeholder</h1>
        <p>
          Admin data below comes from frontend mock helpers. The UI must call
          only the FastAPI backend when real APIs are implemented.
        </p>
        <p>Mock clients: {clients.length}</p>
        <p>Mock campaigns: {campaigns.length}</p>
      </section>
    </main>
  );
}
