import { AccessStateCard } from "../../../components/shared/AccessStateCard";
import { buildPageMetadata } from "../../../components/shared/metadata";

export const dynamic = "force-dynamic";
export const metadata = buildPageMetadata("Accesso cliente");

export default function OnboardingPage() {
  return (
    <AccessStateCard
      eyebrow="Accesso cliente"
      title="Questo flusso non e piu attivo"
      message="Accedi dal pannello o richiedi una nuova email di accesso."
      detail="Il precedente passaggio di onboarding Sendwise e stato disattivato."
      retryHref="/login"
    />
  );
}
