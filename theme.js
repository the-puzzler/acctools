const THEME_STORAGE_KEY = "acctools-theme";
const DEFAULT_THEME = "studio";
const themeButtons = Array.from(document.querySelectorAll("[data-theme-value]"));

function applyTheme(themeName) {
  const nextTheme = themeName || DEFAULT_THEME;
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);

  for (const button of themeButtons) {
    const isActive = button.dataset.themeValue === nextTheme;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

const initialTheme = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
applyTheme(initialTheme);

for (const button of themeButtons) {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.themeValue);
  });
}
