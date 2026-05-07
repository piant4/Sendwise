import { Button } from "../ui/button";

export function AdminTopBarActions() {
  return (
    <>
      <Button type="button" variant="outline" size="lg" disabled>
        Esporta vista
      </Button>
      <Button type="button" size="lg" disabled>
        Aggiungi cliente
      </Button>
    </>
  );
}
