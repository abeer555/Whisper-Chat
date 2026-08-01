      "use strict";

      function renderDateDivider() {
        const today = new Date().toLocaleDateString([], {
          weekday: "long",
          month: "long",
          day: "numeric",
        });
        const div = document.createElement("div");
        div.className = "date-divider";
        div.innerHTML = `<span>${today}</span>`;
        chatMessages.appendChild(div);
      }

      function renderSystemMessage(text) {
        const div = document.createElement("div");
        div.className = "system-msg";
        div.textContent = text;
        chatMessages.appendChild(div);
        scrollToBottom();
      }

      function renderWelcomeCard(channel, user) {
        const div = document.createElement("div");
        div.className = "welcome-card";
        div.innerHTML = `<div class="welcome-emoji">🍵</div>
          <h3>Welcome to #${escapeHTML(channel)}</h3>
          <p>You've joined as <strong>@${escapeHTML(user)}</strong>. Say hello to the room!</p>`;
        chatMessages.appendChild(div);
        scrollToBottom();
      }

      function renderTypingIndicator() {
        const typingIndicatorRow = document.getElementById("typing-indicator-row");
        typingIndicatorRow.innerHTML = "";
        if (typingUsers.size === 0) return;

        const names = [...typingUsers];
        let label;
        if (names.length === 1)      label = `${names[0]} is typing`;
        else if (names.length === 2) label = `${names[0]} and ${names[1]} are typing`;
        else                         label = `${names.slice(0,-1).join(", ")} and ${names.at(-1)} are typing`;

        const bubble = document.createElement("div");
        bubble.className = "typing-bubble";
        bubble.innerHTML = `
          <div class="typing-dots"><span></span><span></span><span></span></div>
          <span class="typing-text">${escapeHTML(label)}…</span>`;
        typingIndicatorRow.appendChild(bubble);
        typingIndicatorRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }

      function spawnParticles() {
        const colors = ["#7bc47f", "#4a9e5c", "#a8d5a2", "#d4f0d0", "#69b56f"];
        for (let i = 0; i < 22; i++) {
          const p = document.createElement("div");
          p.className = "chat-particle";
          const s = Math.random() * 6 + 3;
          p.style.cssText = `width:${s}px;height:${s}px;background:${colors[~~(Math.random() * colors.length)]};left:${Math.random() * 100}%;bottom:${Math.random() * 30}%;animation-duration:${Math.random() * 12 + 10}s;animation-delay:${Math.random() * 10}s`;
          chatMessages.appendChild(p);
        }
      }

      function clearChatMessages() {
        chatMessages.innerHTML = "";
      }
