import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getPostLoginRedirectPath } from "../../../lib/api";

export default async function AuthRedirectPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/login");
  }

  let destinationPath: string;

  try {
    destinationPath = await getPostLoginRedirectPath();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossibile determinare l'accesso Sendwise.";

    return (
      <main className="app-page">
        <section className="card stack-md">
          <div className="stack-xs">
            <p className="eyebrow">Accesso</p>
            <h1>Reindirizzamento non disponibile</h1>
            <p className="text-muted">
              Sendwise non e riuscito a verificare il tuo tipo di accesso dal
              backend.
            </p>
          </div>
          <p className="text-muted">{message}</p>
          <Link className="button button-primary" href="/login">
            Torna al login
          </Link>
        </section>
      </main>
    );
  }

  redirect(destinationPath);
}
