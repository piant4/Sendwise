import { MockLoginForm } from "../../components/auth/MockLoginForm";

export default function LoginPage() {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Development login</p>
        <h1>Sendwise login</h1>
        <p>
          This is a mock frontend-only login for development until backend auth
          is approved. Credentials are not validated, stored, or sent anywhere.
        </p>
        <MockLoginForm />
      </section>
    </main>
  );
}
