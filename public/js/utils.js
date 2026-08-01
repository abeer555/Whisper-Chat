      "use strict";

      function escapeHTML(str) {
        const d = document.createElement("div");
        d.textContent = str;
        return d.innerHTML;
      }
      function scrollToBottom() {
        // Use scrollTop, not scrollTo({behavior:"smooth"}). Smooth scrolling
        // can silently no-op when called outside a user gesture (e.g. from a
        // WebSocket onmessage handler), leaving newly-arrived messages
        // rendered but invisible below the fold.
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
      function getTimeString() {
        return new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      function formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
      }
      function genMsgId() {
        // Combine sessionId (globally-unique per page load) with a monotonic
        // counter and a wall-clock stamp. Prevents cross-session ack collisions
        // and stays lexicographically sortable for a given sender.
        genMsgId._n = (genMsgId._n || 0) + 1;
        return (
          sessionId +
          "-" +
          Date.now().toString(36) +
          "-" +
          genMsgId._n.toString(36)
        );
      }
