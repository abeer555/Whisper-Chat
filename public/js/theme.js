      "use strict";

      // The Aureolin/Bistre palette is dark-by-default; "light" theme is a
      // legacy toggle kept for users who prefer it.
      const THEME_KEY = "whisper-theme";

      function setTheme(t) {
        document.documentElement.setAttribute("data-theme", t);
        localStorage.setItem(THEME_KEY, t);
      }
      function initTheme() {
        setTheme(localStorage.getItem(THEME_KEY) || "dark");
      }
      themeToggle.addEventListener("click", () => {
        setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
      });
