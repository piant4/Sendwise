import { THEME_STORAGE_KEY } from "@/lib/theme";

const themeScript = `
(() => {
  const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  const darkClass = "dark";

  const getStoredPreference = () => {
    try {
      const value = window.localStorage.getItem(storageKey);
      return value === "light" || value === "dark" || value === "system" ? value : "system";
    } catch {
      return "system";
    }
  };

  const getSystemTheme = () =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  const applyTheme = (preference) => {
    const resolved = preference === "system" ? getSystemTheme() : preference;
    const root = document.documentElement;
    root.classList.toggle(darkClass, resolved === "dark");
    root.dataset.themePreference = preference;
    root.dataset.themeResolved = resolved;
    root.style.colorScheme = resolved;
  };

  applyTheme(getStoredPreference());
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
