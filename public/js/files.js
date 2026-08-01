      "use strict";

      const fileInput       = document.getElementById("file-input");
      const btnAttach       = document.getElementById("btn-attach");
      const filePreviewBar  = document.getElementById("file-preview-bar");
      const lightbox        = document.getElementById("lightbox");
      const lightboxImg     = document.getElementById("lightbox-img");
      const lightboxClose   = document.getElementById("lightbox-close");

      const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

      function fileIcon(mimeType) {
        if (mimeType.startsWith("image/")) return "🖼️";
        if (mimeType.startsWith("video/")) return "🎬";
        if (mimeType.startsWith("audio/")) return "🎵";
        if (mimeType === "application/pdf") return "📄";
        if (mimeType.startsWith("text/")) return "📝";
        return "📎";
      }

      btnAttach.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", () => {
        const f = fileInput.files[0];
        if (!f) return;
        if (f.size > MAX_FILE_SIZE) {
          renderSystemMessage(`File too large (${formatBytes(f.size)}). Max ${formatBytes(MAX_FILE_SIZE)}.`);
          fileInput.value = "";
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          stagedFile.file = f;
          stagedFile.dataURL = reader.result;
          showFilePreviewBar(f, reader.result);
        };
        reader.readAsDataURL(f);
        fileInput.value = "";
      });

      function showFilePreviewBar(file, dataURL) {
        filePreviewBar.innerHTML = `
          <div class="file-preview">
            <span class="file-preview-icon">${fileIcon(file.type)}</span>
            <span class="file-preview-name">${escapeHTML(file.name)}</span>
            <span class="file-preview-size">${formatBytes(file.size)}</span>
            <button class="file-preview-remove" id="file-preview-remove" title="Remove">✕</button>
          </div>`;
        filePreviewBar.classList.add("show");
        document.getElementById("file-preview-remove")
          .addEventListener("click", clearStagedFile);
      }

      function clearStagedFile() {
        stagedFile.file = null;
        stagedFile.dataURL = null;
        stagedFile.overrides = null;
        filePreviewBar.classList.remove("show");
        filePreviewBar.innerHTML = "";
      }

      function handleSendFile() {
        if (!stagedFile.file) return;
        const payload = {
          filename: stagedFile.file.name,
          mimeType: stagedFile.file.type || "application/octet-stream",
          size: stagedFile.file.size,
          dataURL: stagedFile.dataURL,
        };
        // Render locally for the sender
        renderFileMessage(currentUser, payload, true);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "file", ...payload }));
        }
        clearStagedFile();
      }

      function handleReceiveFile(sender, payload) {
        renderFileMessage(sender, payload, false);
        showNotification(sender, `sent a file: ${payload.filename}`);
      }

      function renderFileMessage(sender, payload, isMe) {
        const msgDiv = document.createElement("div");
        msgDiv.className = `msg-wrapper ${isMe ? "sent" : "received"}`;
        const isImage = payload.mimeType.startsWith("image/");
        const content = isImage
          ? `<img class="msg-image" src="${payload.dataURL}" alt="${escapeHTML(payload.filename)}" />`
          : `<a class="file-card" href="${payload.dataURL}" download="${escapeHTML(payload.filename)}">
               <span class="file-card-icon">${fileIcon(payload.mimeType)}</span>
               <span class="file-card-meta">
                 <span class="file-card-name">${escapeHTML(payload.filename)}</span>
                 <span class="file-card-size">${formatBytes(payload.size)}</span>
               </span>
               <span class="file-card-dl">⬇</span>
             </a>`;
        msgDiv.innerHTML = `
          <div class="msg-author">${isMe ? "You" : escapeHTML(sender)}</div>
          <div class="msg-bubble file-bubble">${content}</div>
          <div class="msg-time">${getTimeString()}</div>`;
        if (isImage) {
          msgDiv.querySelector(".msg-image").addEventListener("click", () => openLightbox(payload.dataURL));
        }
        chatMessages.appendChild(msgDiv);
        scrollToBottom();
      }

      function openLightbox(src) {
        lightboxImg.src = src;
        lightbox.classList.add("show");
      }
      function closeLightbox() {
        lightbox.classList.remove("show");
        lightboxImg.src = "";
      }
      lightboxClose.addEventListener("click", closeLightbox);
      lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
