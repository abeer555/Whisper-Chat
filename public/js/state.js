      "use strict";

      let currentUser = "";
      let currentChannel = "";
      let currentPassword = "";
      let isChatActive = false;

      let ws = null;
      let isReconnecting = false;
      let reconnectDelay = 2000;
      let isSubmitting = false;

      let pingTimer = null;
      let pongTimeout = null;
      let reconnectTimer = null;

      // ── Delivery receipts (msgId → tick el). Single ✓ = server ACKed it; ✓✓ = peer rendered it.
      const pendingTicks = new Map();

      // ── Outbound message queue ──
      // Messages the user tried to send while the socket was down. Flushed
      // in-order on the next successful reconnect so nothing is silently lost.
      // IMPORTANT: scope is per-session. Leave/join must clear this, otherwise
      // a queue built against room X will be flushed into room Y.
      const outboxQueue = [];

      // ── Per-page-load session identifier ──
      // Stamped onto every outgoing msgId so an ack from a previous page-load
      // (or a ghost reconnect) can't accidentally flip a tick on a fresh send.
      const sessionId = Math.random().toString(36).slice(2, 10);

      // ── Presence ──
      const onlineUsers = new Map(); // username → { online, el }

      // ── Reply context ──
      let replyingTo = null; // { sender, text }

      // ── Typing ──
      const typingUsers = new Set();

      // ── File staging ──
      const stagedFile = { file: null, dataURL: null, overrides: null };

      // ── Call state is defined in calls.js (it owns `callState`) ──
      // ── Background state is defined in background.js (it owns `activeBgValue`) ──
