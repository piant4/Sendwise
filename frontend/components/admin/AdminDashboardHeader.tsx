import { Button } from "../ui/button";
import { StatusBadge } from "../ui/StatusBadge";

interface AdminDashboardHeaderProps {
  isMockMode: boolean;
}

export function AdminDashboardHeader({
  isMockMode,
}: AdminDashboardHeaderProps) {
  const environmentLabel = isMockMode ? "Ambiente locale" : "API frontend";

  return (
    <section className="admin-hero">
      <div className="admin-hero__copy">
        <p className="admin-hero__eyebrow">Sendwise admin</p>
        <div className="admin-hero__headline">
          <h1 className="admin-hero__title">Controllo operativo centralizzato</h1>
          <p className="admin-hero__lead">
            Vista primaria per clienti, campagne, limiti email e stato
            piattaforma. L&apos;operativita resta controllata dal boundary
            frontend attuale.
          </p>
        </div>
        <div className="admin-hero__status-row">
          <StatusBadge label={environmentLabel} variant="neutral" />
          <StatusBadge label="Accesso interno" variant="success" />
          <span className="admin-hero__helper">
            Abilitazione account gestita internamente.
          </span>
        </div>
      </div>

      <div className="admin-hero__actions">
        <div className="admin-hero__actions-copy">
          <span>Azioni disponibili nelle prossime milestone</span>
          <strong>Nessuna operazione scrive dati in questa vista.</strong>
        </div>
        <div className="admin-hero__actions-row">
          <Button variant="outline" size="lg" disabled>
            Esporta vista
          </Button>
          <Button size="lg" disabled>
            Nuovo account
          </Button>
        </div>
      </div>
    </section>
  );
}
