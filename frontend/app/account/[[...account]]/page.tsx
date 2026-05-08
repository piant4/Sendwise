import { UserProfile } from "@clerk/nextjs";

export default function AccountPage() {
  return (
    <main className="account-page">
      <div className="account-page__glow account-page__glow--mint" />
      <div className="account-page__glow account-page__glow--aqua" />

      <div className="account-layout">
        <section className="account-hero">
          <p className="account-hero__eyebrow">Area riservata</p>
          <h1 className="account-hero__title">Account</h1>
          <p className="account-hero__lead">
            Gestisci profilo, email e sicurezza del tuo accesso Sendwise.
          </p>
        </section>

        <section className="account-card" aria-label="Gestione account">
          <div className="account-card__intro">
            <span className="account-card__badge">Centro account</span>
            <div className="account-card__copy">
              <h2>Profilo e sicurezza</h2>
              <p>
                Le impostazioni sensibili restano gestite da Clerk, incluse email,
                password e verifiche del tuo accesso.
              </p>
            </div>
          </div>

          <div className="account-card__profile">
            <UserProfile path="/account" routing="path" />
          </div>
        </section>
      </div>
    </main>
  );
}
