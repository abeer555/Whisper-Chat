      "use strict";

      // ── Send / receive chat messages ──────────────────────────────

      function renderMessage(sender, text, isMe, replyTo = null, msgId = null) {
        const msgDiv = document.createElement("div");
        msgDiv.className = `msg-wrapper ${isMe ? "sent" : "received"}`;
        // Detect pure-emoji messages → render larger
        const isPureEmoji =
          /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\uFE0F|\u200D|\s)+$/u.test(
            text.trim(),
          ) && text.trim().length <= 12;
        const bubbleStyle = isPureEmoji
          ? ' style="font-size:28px;background:transparent;box-shadow:none;padding:4px 8px;"'
          : "";

        const replyQuoteHTML = replyTo
          ? `<div class="msg-reply-quote">
               <div class="msg-reply-quote-author">${escapeHTML(replyTo.sender)}</div>
               <div class="msg-reply-quote-text">${escapeHTML(replyTo.text)}</div>
             </div>`
          : "";

        msgDiv.innerHTML = `
          <div class="msg-author">${isMe ? "You" : escapeHTML(sender)}</div>
          <div class="msg-bubble"${bubbleStyle}>
            ${replyQuoteHTML}
            ${escapeHTML(text)}
          </div>
          <button class="reply-btn" title="Reply" aria-label="Reply to this message">↩</button>
          <div class="msg-time">${getTimeString()}${isMe ? '<span class="msg-ticks"></span>' : ""}</div>`;

        msgDiv.querySelector(".reply-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          startReply(sender, text);
        });

        chatMessages.appendChild(msgDiv);
        scrollToBottom();

        if (isMe && msgId) pendingTicks.set(msgId, msgDiv.querySelector(".msg-ticks"));
      }

      function handleSendMessage(text) {
        const reply = replyingTo;
        const msgId = genMsgId();
        renderMessage(currentUser, text, true, reply, msgId);
        const payload = { type: "chat", text, replyTo: reply || undefined, msgId };
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(payload));
        } else {
          // Socket isn't alive — queue so we don't silently drop on the floor.
          // The reconnect path flushes the queue instead of losing the message.
          outboxQueue.push(payload);
          renderSystemMessage("⚠️ Not connected — message queued until we reconnect.");
          scheduleReconnect();
        }
        messageInput.value = "";
        updateSendReady();
        cancelReply();
        clearTypingOnSend();
      }

      function handleReceiveMessage(sender, text, replyTo = null, msgId = null) {
        try {
          if (typingUsers.delete(sender)) renderTypingIndicator();
          renderMessage(sender, text, false, replyTo);
          showNotification(sender, text);
          if (msgId) wsSend({ type: "msg_delivered", msgId, to: sender });
        } catch (err) {
          // Never let a render bug eat the message — log so we can diagnose.
          console.error("[chat] failed to render incoming message:", err, { sender, text });
        }
      }

      // ── Typing (sender side) ──
      let typingSent = false;
      function sendTyping() {
        if (!isChatActive || !(ws && ws.readyState === WebSocket.OPEN)) return;
        if (!typingSent) {
          typingSent = true;
          wsSend({ type: "typing_start" });
        }
        clearTimeout(clearTypingOnSend._t);
        clearTypingOnSend._t = setTimeout(() => {
          wsSend({ type: "typing_stop" });
          typingSent = false;
        }, 1600);
      }
      function clearTypingOnSend() {
        typingSent = false;
        if (ws && ws.readyState === WebSocket.OPEN) wsSend({ type: "typing_stop" });
        clearTimeout(clearTypingOnSend._t);
      }

      // ── Send-button enable/disable — text OR a staged file is enough ──
      // The send button lives OUTSIDE #chat-form (a sibling using
      // form="chat-form"), so query it via document, not the form.
      function updateSendReady() {
        const hasText = messageInput.value.trim().length > 0;
        const hasFile = !!(stagedFile && stagedFile.file);

        messageInput.classList.toggle("has-text", hasText);

        const btnSend = document.querySelector(".btn-send");
        if (btnSend) btnSend.disabled = !(hasText || hasFile);

        const btnAttach = document.getElementById("btn-attach");
        if (btnAttach) btnAttach.classList.toggle("has-file", hasFile);
      }

      // Keep the send button state in sync as the user types.
      messageInput.addEventListener("input", updateSendReady);
