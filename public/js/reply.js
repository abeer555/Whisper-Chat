      "use strict";

      function startReply(sender, text) {
        replyingTo = { sender, text };
        const bar = document.getElementById("reply-context-bar");
        document.getElementById("reply-context-author").textContent =
          `Replying to ${sender === currentUser ? "yourself" : sender}`;
        document.getElementById("reply-context-text").textContent = text;
        bar.classList.add("visible");
        messageInput.focus();
      }
      function cancelReply() {
        replyingTo = null;
        document.getElementById("reply-context-bar").classList.remove("visible");
      }
      document.getElementById("reply-context-dismiss").addEventListener("click", cancelReply);
