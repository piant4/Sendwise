interface SectionPlaceholderPageProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function SectionPlaceholderPage({
  eyebrow,
  title,
  description,
}: SectionPlaceholderPageProps) {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
    </main>
  );
}
