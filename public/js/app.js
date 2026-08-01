      "use strict";

      // ═══════════════════════════════════════════════════════════
      //  BOOT  — login / chat / leave wiring
      // ═══════════════════════════════════════════════════════════

      // Login
      loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        currentUser = document.getElementById("username").value.trim();
        currentChannel = document.getElementById("channel").value.trim();
        currentPassword = document.getElementById("password").value;

        document.getElementById("display-channel").innerText = currentChannel;
        document.getElementById("display-user").innerText = `@${currentUser}`;

        try {
          await connectWebSocket();
        } catch (err) {
          alert(
            "Could not connect to server. Make sure the server is running (node server.js).",
          );
          return;
        }

        loginScreen.classList.add("hidden");
        setTimeout(() => {
          chatScreen.classList.remove("hidden");
          isChatActive = true;
          messageInput.focus();
          chatMessages.innerHTML = "";
          pendingTicks.clear(); // fresh room — drop any stale receipt handles
          renderDateDivider();
          renderWelcomeCard(currentChannel, currentUser);
          addPresenceUser(currentUser, true);
          requestNotifPermission();
          updateSendReady(); // enable/disable send button for fresh room
          if (activeBgValue) applyBackground(activeBgValue);
        }, 400);
      });

      // Demo-room shortcut — seeds a public room that any visitor can join
      // with one click. The username is auto-randomised so two people clicking
      // the button land in the same room as different users.
      (function wireDemoButton() {
        const btn = document.getElementById("btn-demo");
        if (!btn) return;
        btn.addEventListener("click", function () {
          const noun = ["Fox", "Owl", "Wren", "Pine", "Nimbus", "Comet", "Ash", "Elm"][
            Math.floor(Math.random() * 8)
          ];
          const suffix = Math.floor(100 + Math.random() * 900);
          document.getElementById("username").value = `${noun}-${suffix}`;
          document.getElementById("channel").value = "public-demo";
          document.getElementById("password").value = "demo";
          loginForm.requestSubmit();
        });
      })();

      // Chat form submit — isSubmitting flag prevents double-send if the user
      // somehow triggers submit twice in rapid succession.
      chatForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (isSubmitting) return;

        const text = messageInput.value.trim();
        if (!text && !stagedFile.file) return;

        isSubmitting = true;

        // Send staged file first (if any)
        if (stagedFile.file) {
          handleSendFile();
        }

        // Send text message if there's text in the input
        if (text) {
          handleSendMessage(text);
        }

        // Always reset — previously this never ran if handleSend* threw,
        // locking the form permanently
        isSubmitting = false;
      });

      // Leave — also bound to the Disconnect button via inline onclick.
      function leaveChat() {
        isChatActive = false;
        isReconnecting = false;
        if (typeof endCall === "function") endCall(false); // hang up any in-progress call

        // Stop keep-alive and any pending reconnect attempt
        clearInterval(pingTimer);
        pingTimer = null;
        clearTimeout(pongTimeout);
        pongTimeout = null;
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
        pendingTicks.clear();

        if (ws) {
          ws.onclose = null;
          ws.onerror = null;
          try {
            ws.close();
          } catch (_) {}
          ws = null;
        }

        chatScreen.classList.add("hidden");
        setTimeout(() => {
          loginScreen.classList.remove("hidden");
          loginForm.reset();
          onlineUsers.forEach((_, k) => removePresenceUser(k));
          onlineUsers.clear();
          presenceList.innerHTML = "";
          currentUser = currentChannel = currentPassword = "";
          reconnectDelay = 2000;
          messageInput.value = "";
          messageInput.classList.remove("has-text");
          updateSendReady();
        }, 400);
      }

      // ── Global key capture ──
      // Focus the message input when the user starts typing anywhere outside
      // an editable field. Do NOT fire for IME or combobox contexts, so
      // typing in the emoji search isn't hijacked.
      document.addEventListener("keydown", function (e) {
        if (!isChatActive) return;
        if (e.isComposing) return; // IME in progress
        const active = document.activeElement;
        if (!active) return;
        const tag = active.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        if (active.isContentEditable) return;
        if (active.getAttribute("role") === "combobox") return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        if (e.key === "Tab" || e.key === "Escape" || e.key.startsWith("F"))
          return;
        messageInput.focus();
      });

      // ── Input glow ──
      messageInput.addEventListener("input", function () {
        updateSendReady();
        sendTyping();
      });

      // Boot
      initTheme();
      updateSendReady();
