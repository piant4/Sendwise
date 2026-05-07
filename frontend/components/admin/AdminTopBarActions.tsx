import { Download, UserPlus } from "lucide-react";
import { Button } from "../ui/button";

export function AdminTopBarActions() {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="admin-topbar-action admin-topbar-action--secondary"
        disabled
      >
        <Download aria-hidden="true" className="admin-topbar-action__icon" />
        Esporta vista
      </Button>
      <Button
        type="button"
        size="lg"
        className="admin-topbar-action admin-topbar-action--primary"
        disabled
      >
        <UserPlus aria-hidden="true" className="admin-topbar-action__icon" />
        Aggiungi cliente
      </Button>
    </>
  );
}
