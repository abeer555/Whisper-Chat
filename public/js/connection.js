      "use strict";

      const WS_PROTOCOL = window.location.protocol === "https:" ? "wss:" : "ws:";
      const WS_SERVER = `${WS_PROTOCOL}//${window.location.host}`;

      function connectWebSocket() {
        return new Promise((resolve, reject) => {
          const params = new URLSearchParams({
            channel: currentChannel,
            password: currentPassword,
            username: currentUser,
          });

          // Always close any lingering socket before creating a new one
          // to prevent ghost connections that produce duplicate messages.
          if (ws) {
            ws.onclose = null;
            ws.onerror = null;
            try { ws.close(); } catch (_) {}
            ws = null;
          }

          const socket = new WebSocket(`${WS_SERVER}/?${params}`);
          ws = socket;

          socket.onopen = () => {
            reconnectDelay = 2000;
            // 25 s app-level keep-alive: keeps NAT entries / mobile radios awake,
            // and gives the link a self-heal deadline if it dies silently.
            clearInterval(pingTimer);
            clearTimeout(pongTimeout);
            pingTimer = setInterval(() => {
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "ping" }));
                clearTimeout(pongTimeout);
                pongTimeout = setTimeout(() => {
                  if (isChatActive && ws) { try { ws.close(); } catch (_) {} }
                }, 15_000);
              }
            }, 25_000);
            // Flush anything that was queued while the socket was down.
            flushOutboxQueue();
            resolve();
          };

          socket.onmessage = (event) => {
            if (socket !== ws) return; // stale socket
            clearTimeout(pongTimeout);
            pongTimeout = null;
            try {
              const data = JSON.parse(event.data);
              switch (data.type) {
                case "room_state":
                  data.users.forEach((u) => addPresenceUser(u, true));
                  break;
                case "user_joined":
                  handleUserJoined(data.username);
                  break;
                case "user_left":
                  handleUserLeft(data.username);
                  removePresenceUser(data.username);
                  typingUsers.delete(data.username);
                  renderTypingIndicator();
                  break;
                case "chat":
                  handleReceiveMessage(data.username, data.text, data.replyTo || null, data.msgId || null);
                  break;
                case "msg_ack": {
                  const el = pendingTicks.get(data.msgId);
                  if (el && !el.classList.contains("delivered")) el.textContent = "✓";
                  break;
                }
                case "msg_delivered": {
                  const el = pendingTicks.get(data.msgId);
                  if (el) {
                    el.textContent = "✓✓";
                    el.classList.add("delivered");
                    pendingTicks.delete(data.msgId);
                  }
                  break;
                }
                case "typing_start":
                  typingUsers.add(data.username);
                  renderTypingIndicator();
                  break;
                case "typing_stop":
                  typingUsers.delete(data.username);
                  renderTypingIndicator();
                  break;
                case "file":
                  handleReceiveFile(data.username, {
                    filename: data.filename,
                    mimeType: data.mimeType,
                    size: data.size,
                    dataURL: data.dataURL,
                  });
                  break;
                case "webrtc_offer":
                  handleWebRTCOffer(data.from, data.payload);
                  break;
                case "webrtc_answer":
                  handleWebRTCAnswer(data.payload);
                  break;
                case "webrtc_ice":
                  handleWebRTCIce(data.payload);
                  break;
                case "call_request":
                  showIncomingCall(data.from);
                  break;
                case "call_accepted":
                  onCallAccepted(data.from);
                  break;
                case "call_declined":
                  onCallDeclined(data.from);
                  break;
                case "call_ended":
                  endCall(true);
                  break;
              }
            } catch (_) {}
          };

          socket.onclose = () => {
            if (socket !== ws) return; // already replaced
            clearTimeout(pongTimeout);
            pongTimeout = null;
            if (!isChatActive) return;
            scheduleReconnect();
          };

          socket.onerror = () => {
            if (socket === ws) reject(new Error("WebSocket connection failed"));
          };
        });
      }

      // ── Reconnect with back-off, plus a fast wake-up probe ─────────
      function scheduleReconnect() {
        if (!isChatActive || isReconnecting) return;
        isReconnecting = true;
        renderSystemMessage(`Connection lost. Reconnecting in ${reconnectDelay / 1000}s…`);
        reconnectTimer = setTimeout(runReconnectAttempt, reconnectDelay);
      }

      function runReconnectAttempt() {
        if (!isChatActive) { isReconnecting = false; return; }
        connectWebSocket()
          .then(() => {
            isReconnecting = false;
            renderSystemMessage("Reconnected ✓");
          })
          .catch(() => {
            reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
            if (isChatActive) {
              reconnectTimer = setTimeout(runReconnectAttempt, reconnectDelay);
            } else {
              isReconnecting = false;
            }
          });
      }

      // Wake-up: when the tab or network comes back, don't wait for the
      // scheduled retry — try immediately. IMPORTANT: only trigger when
      // the socket is actually dead. Don't proactively close a live
      // connection — that creates a window where messages routed to the
      // dying socket (which the server is mid-evicting) are lost.
      function attemptReconnectNow() {
        if (!isChatActive) return;
        // If the socket is still OPEN, everything is fine — don't touch it.
        if (ws && ws.readyState === WebSocket.OPEN) return;
        if (ws && ws.readyState === WebSocket.CONNECTING) return;
        if (isReconnecting) {
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(runReconnectAttempt, 250);
        } else {
          scheduleReconnect();
        }
      }
      document.addEventListener("visibilitychange", () => { if (!document.hidden) attemptReconnectNow(); });
      window.addEventListener("pageshow", attemptReconnectNow);
      window.addEventListener("online", attemptReconnectNow);

      function wsSend(data) {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
      }

      // Drain anything staged while the socket was dead.
      function flushOutboxQueue() {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        while (outboxQueue.length > 0) {
          const msg = outboxQueue.shift();
          try {
            ws.send(JSON.stringify(msg));
          } catch (err) {
            // Push it back to the front and stop — we'll try again on next open.
            outboxQueue.unshift(msg);
            return;
          }
        }
      }

      function teardownConnection() {
        isChatActive = false;
        isReconnecting = false;
        clearInterval(pingTimer);
        clearTimeout(pongTimeout);
        clearTimeout(reconnectTimer);
        pingTimer = pongTimeout = reconnectTimer = null;
        pendingTicks.clear();
        if (ws) {
          ws.onclose = null;
          ws.onerror = null;
          try { ws.close(); } catch (_) {}
          ws = null;
        }
      }
