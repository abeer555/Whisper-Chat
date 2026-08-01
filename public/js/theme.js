      "use strict";

      const THEME_KEY = "matcha-theme";

      function setTheme(t) {
        document.documentElement.setAttribute("data-theme", t);
        localStorage.setItem(THEME_KEY, t);
        themeToggle.textContent = t === "dark" ? "🌙" : "☀️";
      }
      function initTheme() {
        setTheme(localStorage.getItem(THEME_KEY) ||
          (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
      }
      themeToggle.addEventListener("click", () => {
        setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
      });
