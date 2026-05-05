import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">V1 Skeleton</p>
        <h1>Email AI Automation Platform</h1>
        <p>
          Milestone 0 base repository. The custom Next.js UI talks only to the
          FastAPI backend. No real sending, AI generation, auth, or dashboard
          product logic is implemented.
        </p>
        <nav className="nav" aria-label="Skeleton pages">
          <Link href="/login">Login</Link>
          <Link href="/admin">Admin</Link>
          <Link href="/client">Client</Link>
        </nav>
      </section>
    </main>
  );
}
