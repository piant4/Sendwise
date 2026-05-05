import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">V1 Frontend Shell</p>
        <h1>Sendwise</h1>
        <p>
          Minimal product shell for the Sendwise admin and client dashboard
          areas. These routes are placeholders only and do not fetch data or
          implement product logic.
        </p>
        <nav className="link-row" aria-label="Sendwise dashboard areas">
          <Link href="/admin">Admin</Link>
          <Link href="/client">Client</Link>
        </nav>
      </section>
    </main>
  );
}
