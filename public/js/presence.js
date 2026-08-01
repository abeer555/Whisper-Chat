      "use strict";

      function addPresenceUser(username, isOnline = true) {
        if (onlineUsers.has(username)) return;
        const el = document.createElement("div");
        el.className = "presence-chip";
        el.innerHTML = `<span class="presence-dot ${isOnline ? "online" : "offline"}"></span>${escapeHTML(username)}`;
        presenceList.appendChild(el);
        onlineUsers.set(username, { online: isOnline, el });
        updatePresenceCount();
      }

      function removePresenceUser(username) {
        const e = onlineUsers.get(username);
        if (e) e.el.remove();
        onlineUsers.delete(username);
        updatePresenceCount();
      }

      function setPresenceStatus(username, isOnline) {
        const e = onlineUsers.get(username);
        if (!e) return;
        e.online = isOnline;
        e.el.querySelector(".presence-dot").className =
          `presence-dot ${isOnline ? "online" : "offline"}`;
        updatePresenceCount();
      }

      function updatePresenceCount() {
        const total = onlineUsers.size;
        const on = [...onlineUsers.values()].filter((u) => u.online).length;
        presenceCount.textContent = `${on}/${total} online`;
      }

      function handleUserJoined(username) {
        addPresenceUser(username, true);
      }

      function handleUserLeft(username) {
        removePresenceUser(username);
        typingUsers.delete(username);
        renderTypingIndicator();
        // callState lives in calls.js which loads AFTER this file. Guard the
        // dereference so a user_left frame arriving before calls.js has run
        // (rare but possible during boot) doesn't throw a ReferenceError.
        if (
          typeof callState !== "undefined" &&
          callState.peer === username &&
          typeof endCall === "function"
        ) {
          endCall(true);
        }
      }
