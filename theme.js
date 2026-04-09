const THEME_STORAGE_KEY = "acctools-theme";
const DEFAULT_THEME = "calm";
const NIGHT_THEME = "graphite";
const themeToggle = document.querySelector("#theme-toggle");

function applyTheme(themeName) {
  const nextTheme = themeName || DEFAULT_THEME;
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);

  if (themeToggle) {
    const isNightMode = nextTheme === NIGHT_THEME;
    themeToggle.setAttribute("aria-pressed", String(isNightMode));
    themeToggle.setAttribute(
      "aria-label",
      isNightMode ? "Disable night mode" : "Enable night mode",
    );
    themeToggle.textContent = isNightMode ? "Day mode" : "Night mode";
  }
}

const initialTheme = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
applyTheme(initialTheme);

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.dataset.theme || DEFAULT_THEME;
    applyTheme(currentTheme === NIGHT_THEME ? DEFAULT_THEME : NIGHT_THEME);
  });
}
