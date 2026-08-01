      // ═══════════════════════════════════════════════════════════
      //  FILE & PHOTO SENDING
      // ═══════════════════════════════════════════════════════════

      // ═══════════════════════════════════════════════════════════
      //  BACKGROUND PICKER
      // ═══════════════════════════════════════════════════════════
      const BG_PRESETS = [
        { label: "Default",    value: "" },
        { label: "Sage",       value: "linear-gradient(135deg,#e8f5e9 0%,#f1f8e9 100%)" },
        { label: "Peach",      value: "linear-gradient(135deg,#fff3e0 0%,#fce4ec 100%)" },
        { label: "Ocean",      value: "linear-gradient(135deg,#e3f2fd 0%,#e8eaf6 100%)" },
        { label: "Rose",       value: "linear-gradient(135deg,#fce4ec 0%,#f8bbd9 100%)" },
        { label: "Lavender",   value: "linear-gradient(135deg,#ede7f6 0%,#e8eaf6 100%)" },
        { label: "Mint",       value: "linear-gradient(135deg,#e0f2f1 0%,#b2dfdb 100%)" },
        { label: "Sunset",     value: "linear-gradient(135deg,#ff9a9e 0%,#fecfef 50%,#fecfef 100%)" },
        { label: "Nordic",     value: "linear-gradient(135deg,#2d3561 0%,#a16bfe 100%)" },
        { label: "Midnight",   value: "linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)" },
        { label: "Forest",     value: "linear-gradient(135deg,#134e5e 0%,#71b280 100%)" },
        { label: "Pure White", value: "#ffffff" },
      ];

      const bgPickerPanel  = document.getElementById("bg-picker-panel");
      const bgPickerBtn    = document.getElementById("btn-bg-picker");
      const bgSwatchGrid   = document.getElementById("bg-swatch-grid");
      const bgCustomInput  = document.getElementById("bg-custom-input");
      const chatMessagesEl = document.getElementById("chat-messages");

      let activeBgValue = localStorage.getItem("matcha-bg") || "";

      function applyBackground(value, fromSwatch = false) {
        activeBgValue = value;
        if (value === "") {
          chatMessagesEl.style.removeProperty("background");
          chatMessagesEl.style.removeProperty("background-color");
        } else if (value.startsWith("#")) {
          chatMessagesEl.style.background = value;
        } else {
          chatMessagesEl.style.background = value;
        }
        localStorage.setItem("matcha-bg", value);
        // Update swatch active states
        bgSwatchGrid.querySelectorAll(".bg-swatch").forEach((el) => {
          el.classList.toggle("active", el.dataset.value === value);
        });
        if (!fromSwatch && !value.startsWith("linear")) {
          bgCustomInput.value = value || "#f1f5f2";
        }
      }

      // Build swatch grid
      BG_PRESETS.forEach(({ label, value }) => {
        const swatch = document.createElement("button");
        swatch.type = "button";
        swatch.className = "bg-swatch" + (activeBgValue === value ? " active" : "");
        swatch.title = label;
        swatch.dataset.value = value;
        const bg = value || "linear-gradient(135deg,#f1f5f2 0%,#e8f0ea 100%)";
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
