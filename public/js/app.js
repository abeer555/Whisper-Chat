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
          spawnParticles();
          renderDateDivider();
          renderWelcomeCard(currentChannel, currentUser);
          addPresenceUser(currentUser, true);
          requestNotifPermission();
          if (activeBgValue) applyBackground(activeBgValue);
        }, 400);
      });

      // Chat form submit — isSubmitting flag prevents double-send if the user
      // somehow triggers submit twice in rapid succession.
      chatForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (isSubmitting) return;
        isSubmitting = true;

        // Send staged file first (if any)
        if (stagedFile.file) {
          handleSendFile();
        }

        // Send text message if there's text in the input
        const text = messageInput.value.trim();
        if (text) {
          handleSendMessage(text);
        }

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
        }, 400);
      }

      // ── Global key capture ──
      document.addEventListener("keydown", function (e) {
        if (!isChatActive) return;
        const tag = document.activeElement.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        if (e.key === "Tab" || e.key === "Escape" || e.key.startsWith("F"))
          return;
        messageInput.focus();
      });

      // ── Input glow ──
      messageInput.addEventListener("input", function () {
        this.classList.toggle("has-text", this.value.trim().length > 0);
        sendTyping();
      });

      // Boot
      initTheme();
