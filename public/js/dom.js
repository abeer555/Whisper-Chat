      "use strict";

      const loginScreen   = document.getElementById("login-screen");
      const chatScreen    = document.getElementById("chat-screen");
      const loginForm     = document.getElementById("login-form");
      const chatForm      = document.getElementById("chat-form");
      const messageInput  = document.getElementById("message-input");
      const chatMessages  = document.getElementById("chat-messages");
      const presenceList  = document.getElementById("presence-list");
      const presenceCount = document.getElementById("presence-count");
      const themeToggle   = document.getElementById("theme-toggle");
      const remoteAudio   = document.getElementById("remote-audio");

      // ── Misc helpers that belong to the DOM, not individual features ──
      function setHeaderStatus(label) {
        const el = document.querySelector(".chat-header p");
        if (el) el.innerText = label;
      }
