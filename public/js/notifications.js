      "use strict";

      function requestNotifPermission() {
        if (!("Notification" in window)) return;
        if (Notification.permission === "default") Notification.requestPermission();
      }

      function showNotification(sender, text) {
        if (!("Notification" in window)) return;
        if (Notification.permission !== "granted") return;
        if (!document.hidden) return; // only when the tab is in the background
        try {
          new Notification(`Whisper Chat — ${sender}`, { body: text, silent: false });
        } catch (_) {}
      }
