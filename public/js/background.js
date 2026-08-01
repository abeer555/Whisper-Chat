      // ═══════════════════════════════════════════════════════════
      //  FILE & PHOTO SENDING
      // ═══════════════════════════════════════════════════════════

      // ═══════════════════════════════════════════════════════════
      //  BACKGROUND PICKER
      // ═══════════════════════════════════════════════════════════
      const BG_PRESETS = [
        { label: "Default",    value: "" },
        { label: "Bistre",     value: "#261606" },
        { label: "Espresso",   value: "linear-gradient(135deg,#1a0f04 0%,#3d2a10 100%)" },
        { label: "Aureolin",   value: "linear-gradient(135deg,#3d2a10 0%,#8a7408 100%)" },
        { label: "Sunset",     value: "linear-gradient(135deg,#2a1810 0%,#6b2d10 100%)" },
        { label: "Forest",     value: "linear-gradient(135deg,#14210f 0%,#2b3d1a 100%)" },
        { label: "Ocean",      value: "linear-gradient(135deg,#0d1820 0%,#2a3d4a 100%)" },
        { label: "Plum",       value: "linear-gradient(135deg,#1a1420 0%,#3b2d4a 100%)" },
        { label: "Ember",      value: "linear-gradient(135deg,#20100a 0%,#4a2a1a 100%)" },
        { label: "Slate",      value: "linear-gradient(135deg,#161a20 0%,#2b323d 100%)" },
        { label: "Midnight",   value: "linear-gradient(135deg,#0a0714 0%,#1f1a33 100%)" },
        { label: "Pure Black", value: "#000000" },
      ];

      const bgPickerPanel  = document.getElementById("bg-picker-panel");
      const bgPickerBtn    = document.getElementById("btn-bg-picker");
      const bgSwatchGrid   = document.getElementById("bg-swatch-grid");
      const bgCustomInput  = document.getElementById("bg-custom-input");
      const chatMessagesEl = document.getElementById("chat-messages");

      let activeBgValue = localStorage.getItem("whisper-bg") || "";

      function applyBackground(value, fromSwatch = false) {
        activeBgValue = value;
        if (value === "") {
          chatMessagesEl.style.removeProperty("background");
          chatMessagesEl.style.removeProperty("background-color");
        } else {
          chatMessagesEl.style.background = value;
        }
        localStorage.setItem("whisper-bg", value);
        // Update swatch active states
        bgSwatchGrid.querySelectorAll(".bg-swatch").forEach((el) => {
          el.classList.toggle("active", el.dataset.value === value);
        });
        if (!fromSwatch && !value.startsWith("linear")) {
          bgCustomInput.value = value || "#261606";
        }
      }

      // Build swatch grid
      BG_PRESETS.forEach(({ label, value }) => {
        const swatch = document.createElement("button");
        swatch.type = "button";
        swatch.className = "bg-swatch" + (activeBgValue === value ? " active" : "");
        swatch.title = label;
        swatch.dataset.value = value;
        const bg = value || "#261606";
        swatch.style.background = bg;
        swatch.innerHTML = `<span class="bg-swatch-check">✓</span>`;
        swatch.addEventListener("click", () => {
          applyBackground(value, true);
        });
        bgSwatchGrid.appendChild(swatch);
      });

      // Custom colour input
      bgCustomInput.addEventListener("input", function () {
        applyBackground(this.value);
      });

      // Toggle picker panel open/close
      bgPickerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        bgPickerPanel.classList.toggle("open");
      });
      document.addEventListener("click", (e) => {
        if (!bgPickerPanel.contains(e.target) && e.target !== bgPickerBtn) {
          bgPickerPanel.classList.remove("open");
        }
      });

      // Restore persisted BG on load
      if (activeBgValue) applyBackground(activeBgValue);
