import { SignIn } from "@clerk/nextjs";
import { LifeBuoy, ShieldCheck } from "lucide-react";
import { BrandMark } from "../../components/shared/BrandMark";

export function LoginContent() {
  return (
    <main className="login-page">
      <div className="login-page__glow login-page__glow--mint" />
      <div className="login-page__glow login-page__glow--aqua" />

      <div className="login-layout">
        <section className="login-stage">
          <div className="login-pills">
            <span className="login-pill">Accesso riservato</span>
          </div>

          <BrandMark size="lg" />

          <div className="login-copy">
            <p className="login-eyebrow">Piattaforma operativa</p>
            <h1 className="login-title">
              Campagne email, clienti e controllo operativo nello stesso
              workspace.
            </h1>
            <p className="login-lead">
              Spazio riservato per coordinare volumi, stato campagne e presidio
              delle attivita essenziali Sendwise.
            </p>
          </div>
        </section>

        <section className="login-card">
          <div className="login-card__header">
            <h2 className="login-card__title">Accedi</h2>
            <p className="login-card__description">
              Accesso gestito da Clerk per gli utenti autorizzati alla console
              Sendwise.
            </p>
          </div>

          <div className="flex justify-center">
            <SignIn
              forceRedirectUrl="/admin"
              path="/login"
              routing="path"
              withSignUp={false}
              appearance={{
                elements: {
                  card: "w-full max-w-none rounded-[28px] border border-white/10 bg-transparent p-0 shadow-none",
                  header: "hidden",
                  footer: "hidden",
                  rootBox: "w-full",
                  main: "gap-5",
                  formButtonPrimary:
                    "h-12 rounded-2xl bg-[linear-gradient(135deg,#84f7c7_0%,#4fbde6_100%)] text-sm font-semibold text-slate-950 shadow-[0_18px_40px_rgba(79,189,230,0.25)] hover:opacity-95",
                  formFieldLabel:
                    "text-[0.72rem] font-medium uppercase tracking-[0.22em] text-white/70",
                  formFieldInput:
                    "h-12 rounded-2xl border border-white/10 bg-white/5 text-white placeholder:text-white/35 focus:border-emerald-300/60 focus:ring-0",
                  formFieldInputShowPasswordButton:
                    "text-white/55 hover:text-white",
                  socialButtonsBlockButton:
                    "h-12 rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/8",
                  socialButtonsBlockButtonText: "text-sm font-medium",
                  dividerText: "text-white/45",
                  dividerLine: "bg-white/10",
                  identityPreviewText: "text-white/70",
                  formResendCodeLink:
                    "font-medium text-emerald-300 hover:text-emerald-200",
                  formFieldSuccessText: "text-emerald-300",
                  formFieldWarningText: "text-amber-300",
                  alertText: "text-sm text-rose-200",
                  alert: "rounded-2xl border border-rose-400/25 bg-rose-500/10",
                  otpCodeFieldInput:
                    "rounded-2xl border border-white/10 bg-white/5 text-white",
                },
              }}
            />
          </div>

          <div className="login-card__footer">
            <ShieldCheck aria-hidden="true" className="login-card__footer-icon" />
            <div className="login-card__support">
              <strong>Accesso riservato agli utenti autorizzati.</strong>
              <span>
                Abilitazione account e supporto operativo gestiti dal team
                Sendwise.
              </span>
            </div>
            <LifeBuoy aria-hidden="true" className="login-card__footer-accent" />
          </div>
        </section>
      </div>
    </main>
  );
}
