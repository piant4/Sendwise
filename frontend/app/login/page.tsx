import { MockLoginForm } from "../../components/auth/MockLoginForm";

export default function LoginPage() {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Accesso di sviluppo</p>
        <h1>Accesso Sendwise</h1>
        <p>
          Questa è una autenticazione mock solo frontend, usata finché la
          autenticazione backend non viene approvata. Le credenziali non sono
          validate, archiviate o inviate.
        </p>
        <MockLoginForm />
      </section>
    </main>
  );
}
