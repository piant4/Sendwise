"use client";

import { LaptopMinimal, MoonStar, SunMedium } from "lucide-react";
import { useThemePreference } from "./ThemeProvider";
import type { ThemePreference } from "@/lib/theme";

const OPTIONS: Array<{
  description: string;
  Icon: typeof LaptopMinimal;
  label: string;
  value: ThemePreference;
}> = [
  {
    value: "system",
    label: "System",
    description: "Segue automaticamente il tema del browser o del sistema operativo.",
    Icon: LaptopMinimal,
  },
  {
    value: "light",
    label: "Light",
    description: "Mantiene sempre l'interfaccia chiara.",
    Icon: SunMedium,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Mantiene sempre l'interfaccia scura.",
    Icon: MoonStar,
  },
];

export function ThemePreferenceSelector() {
  const { preference, resolvedTheme, setPreference } = useThemePreference();
  const selectedOption = OPTIONS.find((item) => item.value === preference);

  return (
    <section className="settings-section" aria-labelledby="account-theme">
      <div className="settings-section__header">
        <h2 id="account-theme">Tema</h2>
      </div>

      <div className="settings-section__body">
        <div className="theme-preference">
          {/* <div className="theme-preference__status">
            <span className="theme-preference__eyebrow">Preferenza attiva</span>
            <strong className="theme-preference__value">{selectedOption?.label}</strong>
            <p className="theme-preference__description">
              Tema visibile: {resolvedTheme === "dark" ? "Dark" : "Light"}.
            </p>
          </div> */}

          <div
            className="theme-preference__options"
            role="radiogroup"
            aria-label="Preferenza tema Sendwise"
          >
            {OPTIONS.map(({ description, Icon, label, value }) => {
              const isActive = preference === value;

              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className="theme-preference__option"
                  data-active={isActive}
                  onClick={() => setPreference(value)}
                >
                  <span className="theme-preference__option-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="theme-preference__option-copy">
                    <strong>{label}</strong>
                    <span>{isActive ? "Selezionato" : description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
