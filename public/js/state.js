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
      const outboxQueue = [];

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
