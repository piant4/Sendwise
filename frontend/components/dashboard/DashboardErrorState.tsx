import { EmptyState } from "../ui/EmptyState";
import { SectionHeader } from "../ui/SectionHeader";
import { StatusBadge } from "../ui/StatusBadge";

interface DashboardErrorStateProps {
  title: string;
  description: string;
  errorMessage: string;
}

export function DashboardErrorState({
  title,
  description,
  errorMessage,
}: DashboardErrorStateProps) {
  return (
    <main className="shell">
      <section className="panel" style={{ display: "grid", gap: 24 }}>
        <SectionHeader
          title={title}
          description={description}
          actions={<StatusBadge label="Errore dati" variant="danger" />}
        />
        <EmptyState
          title="Impossibile caricare i dati"
          description={errorMessage}
        />
      </section>
    </main>
  );
}
