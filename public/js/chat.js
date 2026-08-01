      "use strict";

      // ── Send / receive chat messages ──────────────────────────────

      function renderMessage(sender, text, isMe, replyTo = null, msgId = null) {
        // Defensive: incoming frames may carry unexpected shapes. Coerce the
        // things we render so a single bad field doesn't kill the whole msg.
        sender = String(sender ?? "?");
        text   = String(text   ?? "");

        const msgDiv = document.createElement("div");
        msgDiv.className = `msg-wrapper ${isMe ? "sent" : "received"}`;

        // Pure-emoji detection renders the bubble larger and transparent.
        let bubbleStyle = "";
        try {
          const trimmed = text.trim();
          const isPureEmoji =
            trimmed.length > 0 &&
            trimmed.length <= 12 &&
            /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\uFE0F|\u200D|\s)+$/u.test(trimmed);
          if (isPureEmoji) {
            bubbleStyle = "font-size:28px;background:transparent;box-shadow:none;padding:4px 8px;";
          }
        } catch (err) { console.warn("[chat] emoji-check failed:", err); }

        // Build via DOM APIs, not innerHTML — avoids any parsing edge cases.
        const author = document.createElement("div");
        author.className = "msg-author";
        author.textContent = isMe ? "You" : sender;
        msgDiv.appendChild(author);

        const bubble = document.createElement("div");
        bubble.className = "msg-bubble";
        if (bubbleStyle) bubble.style.cssText = bubbleStyle;

        // Only render the reply quote when both required fields are present.
        if (
          replyTo &&
          typeof replyTo === "object" &&
          replyTo.sender != null &&
          replyTo.text != null
        ) {
          const quote = document.createElement("div");
          quote.className = "msg-reply-quote";
          const qAuthor = document.createElement("div");
          qAuthor.className = "msg-reply-quote-author";
          qAuthor.textContent = String(replyTo.sender);
          const qText = document.createElement("div");
          qText.className = "msg-reply-quote-text";
          qText.textContent = String(replyTo.text);
          quote.appendChild(qAuthor);
          quote.appendChild(qText);
          bubble.appendChild(quote);
        }
        bubble.appendChild(document.createTextNode(text));
        msgDiv.appendChild(bubble);

        const replyBtn = document.createElement("button");
        replyBtn.className = "reply-btn";
        replyBtn.title = "Reply";
        replyBtn.setAttribute("aria-label", "Reply to this message");
        replyBtn.textContent = "↩";
        replyBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          startReply(sender, text);
        });
        msgDiv.appendChild(replyBtn);

        const time = document.createElement("div");
        time.className = "msg-time";
        time.textContent = getTimeString();
        if (isMe) {
          const ticks = document.createElement("span");
          ticks.className = "msg-ticks";
          time.appendChild(ticks);
          if (msgId) pendingTicks.set(msgId, ticks);
        }
        msgDiv.appendChild(time);

        chatMessages.appendChild(msgDiv);
        scrollToBottom();
      }

      function handleSendMessage(text) {
        const reply = replyingTo;
        const msgId = genMsgId();
        renderMessage(currentUser, text, true, reply, msgId);
        const payload = { type: "chat", text, replyTo: reply || undefined, msgId };
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify(payload));
            console.log("[chat] sent", msgId, `(${text.length} chars)`);
          } catch (err) {
            // ws.send can throw if the socket is being torn down mid-write.
            console.error("[chat] send threw — queueing instead:", err);
            outboxQueue.push(payload);
            renderSystemMessage("⚠️ Send failed — message queued.");
            scheduleReconnect();
          }
        } else {
          // Socket isn't alive — queue so we don't silently drop on the floor.
          // The reconnect path flushes the queue instead of losing the message.
          outboxQueue.push(payload);
          console.warn(
            `[chat] socket not open (state=${ws ? ws.readyState : "null"}) — queued`,
            msgId,
          );
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
        } catch (err) { console.error("[chat] step1 typing-indicator threw:", err); }

        try {
          renderMessage(sender, text, false, replyTo);
        } catch (err) {
          // The render failed — log loudly with full stack so we can pinpoint it
          console.error("[chat] renderMessage threw:", err);
          console.error("[chat] stack:", err && err.stack);
          console.error("[chat] args:", JSON.stringify({ sender, text, replyTo, msgId }));
          // Bare-bones fallback so the message is still visible
          try {
            const fallback = document.createElement("div");
            fallback.className = "msg-wrapper received";
            fallback.style.cssText = "color:#fff;padding:6px;background:#333;border-radius:4px;margin:4px 0;";
            fallback.textContent = `${sender}: ${text}`;
            chatMessages.appendChild(fallback);
            chatMessages.scrollTop = chatMessages.scrollHeight;
          } catch (fbErr) { console.error("[chat] fallback failed:", fbErr); }
        }

        try { showNotification(sender, text); }
        catch (err) { console.error("[chat] showNotification threw:", err); }

        try { if (msgId) wsSend({ type: "msg_delivered", msgId, to: sender }); }
        catch (err) { console.error("[chat] msg_delivered ack threw:", err); }
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
