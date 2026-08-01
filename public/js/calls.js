      // ═══════════════════════════════════════════════════════════
      //  WebRTC VOICE CALLS
      // ═══════════════════════════════════════════════════════════
      const STUN_SERVERS = {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun.cloudflare.com:3478" },
        ],
      };

      const callState = {
        active: false,
        peer: null,
        pc: null,
        stream: null,
        timerID: null,
        connectTimeoutID: null,
        seconds: 0,
        muted: false,
        isInitiator: false,
        // ICE candidates that arrive before setRemoteDescription is called
        // must be buffered — applying them before remote desc throws an error
        // that browsers silently swallow, causing the connection to never form.
        pendingIce: [],
        remoteDescSet: false,
      };

      const callOverlay = document.getElementById("call-overlay");
      const callAvatar = document.getElementById("call-avatar");
      const callCardLabel = document.getElementById("call-card-label");
      const callCardName = document.getElementById("call-card-name");
      const callCardActions = document.getElementById("call-card-actions");
      const activeCallBar = document.getElementById("active-call-bar");
      const callPeerName = document.getElementById("call-peer-name");
      const callTimerEl = document.getElementById("call-timer");
      const btnMute = document.getElementById("btn-mute");
      const remoteAudio = document.getElementById("remote-audio");

      function getCallablePeer() {
        const others = [...onlineUsers.entries()].filter(
          ([u, v]) => u !== currentUser && v.online,
        );
        return others.length === 1 ? others[0][0] : null;
      }

      function refreshCallButton() {
        const btnCall = document.getElementById("btn-call");
        if (!btnCall) return;
        const peer = getCallablePeer();
        if (callState.active) {
          btnCall.classList.remove("call-btn-disabled");
          btnCall.classList.add("call-btn-active");
          btnCall.title = "In call";
        } else if (peer) {
          btnCall.classList.remove("call-btn-disabled", "call-btn-active");
          btnCall.title = `Call @${peer}`;
        } else {
          btnCall.classList.add("call-btn-disabled");
          btnCall.classList.remove("call-btn-active");
          btnCall.title = "Need exactly 1 other online user to call";
        }
      }

      // ── Overlay helpers ──────────────────────────────────────────
      function showCallOverlay(label, name, actions) {
        callCardLabel.textContent = label;
        callCardName.textContent = name ? "@" + name : "";
        callCardActions.innerHTML = "";
        actions.forEach(({ text, cls, fn }) => {
          const b = document.createElement("button");
          b.className = cls;
          b.textContent = text;
          b.onclick = fn;
          callCardActions.appendChild(b);
        });
        callOverlay.classList.add("visible");
      }
      function setOverlayStatus(label) {
        callCardLabel.textContent = label;
      }
      function hideCallOverlay() {
        callOverlay.classList.remove("visible");
      }

      // ── Initiator flow ───────────────────────────────────────────
      async function initiateCall() {
        if (callState.active || callState.peer) return;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          renderSystemMessage(
            "⚠️ Your browser doesn't support voice calls (requires HTTPS or localhost).",
          );
          return;
        }
        const peer = getCallablePeer();
        if (!peer) {
          renderSystemMessage(
            "⚠️ Need exactly 1 other online user to start a call.",
          );
          return;
        }

        callState.peer = peer;
        callState.isInitiator = true;

        // Show overlay immediately — keep it visible through entire setup
        showCallOverlay("Requesting microphone…", peer, [
          { text: "📵", cls: "btn-call-decline", fn: cancelOutgoingCall },
        ]);

        // Get mic before we notify the other side so we're fully ready
        try {
          callState.stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        } catch (err) {
          renderSystemMessage(`⚠️ Microphone error: ${err.message}`);
          callState.peer = null;
          callState.isInitiator = false;
          hideCallOverlay();
          return;
        }

        // Guard: user may have cancelled during the getUserMedia dialog
        if (!callState.peer) {
          stopStream();
          return;
        }

        setOverlayStatus("Calling…");
        wsSend({ type: "call_request", target: peer });
        renderSystemMessage(`📞 Calling @${peer}…`);
      }

      function cancelOutgoingCall() {
        const peer = callState.peer;
        callState.peer = null;
        callState.isInitiator = false;
        stopStream();
        hideCallOverlay();
        if (peer) {
          wsSend({ type: "call_ended", target: peer });
          renderSystemMessage("📵 Call cancelled.");
        }
      }

      // ── Callee flow ──────────────────────────────────────────────
      function showIncomingCall(from) {
        // Don't show if we're already in a call
        if (callState.active || (callState.peer && callState.peer !== from)) {
          wsSend({ type: "call_declined", target: from });
          return;
        }
        callState.peer = from;
        showCallOverlay("Incoming Call", from, [
          { text: "📞", cls: "btn-call-accept", fn: () => acceptCall(from) },
          { text: "📵", cls: "btn-call-decline", fn: () => declineCall(from) },
        ]);
        renderSystemMessage(`📞 Incoming call from @${from}`);
      }

      async function acceptCall(from) {
        if (!callState.peer) return; // already cancelled or timed out
        setOverlayStatus("Requesting microphone…");
        // Disable buttons so they can't be double-clicked
        callCardActions
          .querySelectorAll("button")
          .forEach((b) => (b.disabled = true));

        try {
          callState.stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        } catch (err) {
          renderSystemMessage(`⚠️ Microphone error: ${err.message}`);
          wsSend({ type: "call_declined", target: from });
          callState.peer = null;
          hideCallOverlay();
          return;
        }

        if (!callState.peer) {
          stopStream();
          hideCallOverlay();
          return;
        }

        setOverlayStatus("Connecting…");
        // Create PC BEFORE sending call_accepted so it's ready when offer arrives
        setupPeerConnection(false);
        wsSend({ type: "call_accepted", target: from });
      }

      function declineCall(from) {
        wsSend({ type: "call_declined", target: from });
        callState.peer = null;
        hideCallOverlay();
        renderSystemMessage(`You declined the call from @${from}.`);
      }

      // ── Initiator receives "accepted" ────────────────────────────
      function onCallAccepted(from) {
        // Don't hide overlay — update the status label in-place
        setOverlayStatus("Connecting…");
        // Mic was already acquired in initiateCall; just set up the PC
        callState.peer = from;
        setupPeerConnection(true); // caller creates & sends offer
      }

      function onCallDeclined(from) {
        stopStream();
        hideCallOverlay();
        callState.peer = null;
        callState.isInitiator = false;
        renderSystemMessage(`@${from} declined the call.`);
      }

      function stopStream() {
        if (callState.stream) {
          callState.stream.getTracks().forEach((t) => t.stop());
          callState.stream = null;
        }
      }

      // ── ICE candidate buffering ──────────────────────────────────
      // Preserve any candidates that arrived before the PC was created
      // (can happen if the remote's ICE gathers faster than our async setup).
      function bufferOrAddIce(candidate) {
        if (!callState.pc) {
          callState.pendingIce.push(candidate);
          return;
        }
        if (callState.remoteDescSet) {
          callState.pc
            .addIceCandidate(new RTCIceCandidate(candidate))
            .catch(() => {});
        } else {
          callState.pendingIce.push(candidate);
        }
      }

      async function drainPendingIce() {
        callState.remoteDescSet = true;
        const queue = callState.pendingIce.splice(0); // drain without resetting the array ref
        for (const c of queue) {
          try {
            await callState.pc.addIceCandidate(new RTCIceCandidate(c));
          } catch (_) {}
        }
      }

      // ── Core peer connection ─────────────────────────────────────
      function setupPeerConnection(createOffer) {
        const pc = new RTCPeerConnection(STUN_SERVERS);
        // NOTE: do NOT reset pendingIce here — candidates may have arrived
        // while getUserMedia was running (e.g. from the remote peer's faster setup)
        callState.pc = pc;
        callState.remoteDescSet = false;

        if (callState.stream) {
          callState.stream
            .getTracks()
            .forEach((t) => pc.addTrack(t, callState.stream));
        }

        pc.ontrack = (e) => {
          remoteAudio.srcObject = e.streams[0];
        };

        pc.onicecandidate = (e) => {
          // null candidate = gathering complete; don't send
          if (e.candidate && callState.peer) {
            wsSend({
              type: "webrtc_ice",
              target: callState.peer,
              payload: e.candidate,
            });
          }
        };

        // Use iceConnectionState — most reliable across browsers
        pc.oniceconnectionstatechange = () => {
          const s = pc.iceConnectionState;
          console.log("[call] iceConnectionState →", s);
          if ((s === "connected" || s === "completed") && !callState.active) {
            clearTimeout(callState.connectTimeoutID);
            startActiveCall();
          } else if (s === "failed") {
            renderSystemMessage("⚠️ Call failed (ICE). Try again.");
            endCall(true);
          }
        };

        pc.onconnectionstatechange = () => {
          const s = pc.connectionState;
          console.log("[call] connectionState →", s);
          if (s === "connected" && !callState.active) {
            clearTimeout(callState.connectTimeoutID);
            startActiveCall();
          } else if (s === "failed") {
            endCall(true);
          }
        };

        // 25-second connection timeout
        callState.connectTimeoutID = setTimeout(() => {
          if (!callState.active && callState.pc === pc) {
            renderSystemMessage(
              "⚠️ Call timed out. Could not reach the other side.",
            );
            endCall(true);
          }
        }, 25000);

        if (createOffer) {
          pc.createOffer({ offerToReceiveAudio: true })
            .then((offer) => pc.setLocalDescription(offer))
            .then(() => {
              if (!callState.peer) {
                endCall(true);
                return;
              }
              wsSend({
                type: "webrtc_offer",
                target: callState.peer,
                payload: pc.localDescription,
              });
            })
            .catch((err) => {
              renderSystemMessage(`⚠️ Could not create offer: ${err.message}`);
              endCall(true);
            });
        }
      }

      async function handleWebRTCOffer(from, offer) {
        if (!callState.pc) {
          console.warn("[call] Offer arrived but no PC exists");
          return;
        }
        try {
          await callState.pc.setRemoteDescription(
            new RTCSessionDescription(offer),
          );
          await drainPendingIce();
          const answer = await callState.pc.createAnswer();
          await callState.pc.setLocalDescription(answer);
          wsSend({
            type: "webrtc_answer",
            target: from,
            payload: callState.pc.localDescription,
          });
        } catch (err) {
          renderSystemMessage(`⚠️ WebRTC handshake error: ${err.message}`);
          endCall(true);
        }
      }

      async function handleWebRTCAnswer(answer) {
        if (!callState.pc) return;
        try {
          await callState.pc.setRemoteDescription(
            new RTCSessionDescription(answer),
          );
          await drainPendingIce();
        } catch (err) {
          renderSystemMessage(`⚠️ Could not apply answer: ${err.message}`);
          endCall(true);
        }
      }

      function handleWebRTCIce(candidate) {
        bufferOrAddIce(candidate);
      }

      // ── Active call ──────────────────────────────────────────────
      function startActiveCall() {
        if (callState.active) return; // guard duplicate fires
        callState.active = true;
        callState.seconds = 0;
        callPeerName.textContent = callState.peer;
        activeCallBar.classList.add("visible");
        hideCallOverlay();
        refreshCallButton();
        callState.timerID = setInterval(() => {
          callState.seconds++;
          const m = String(Math.floor(callState.seconds / 60)).padStart(2, "0");
          const s = String(callState.seconds % 60).padStart(2, "0");
          callTimerEl.textContent = `${m}:${s}`;
        }, 1000);
        renderSystemMessage(`📞 Call connected with @${callState.peer}.`);
      }

      function endCall(remote = false) {
        if (!remote && callState.peer) {
          wsSend({ type: "call_ended", target: callState.peer });
        }
        clearInterval(callState.timerID);
        clearTimeout(callState.connectTimeoutID);
        callState.connectTimeoutID = null;
        if (callState.pc) {
          try {
            callState.pc.close();
          } catch (_) {}
          callState.pc = null;
        }
        stopStream();
        remoteAudio.srcObject = null;
        activeCallBar.classList.remove("visible");
        hideCallOverlay();
        const peer = callState.peer;
        callState.active = false;
        callState.muted = false;
        callState.isInitiator = false;
        callState.peer = null;
        callState.seconds = 0;
        callState.pendingIce = [];
        callState.remoteDescSet = false;
        refreshCallButton();
        if (peer) renderSystemMessage(`📵 Call ended.`);
      }

      btnMute.addEventListener("click", () => {
        if (!callState.stream) return;
        callState.muted = !callState.muted;
        callState.stream.getAudioTracks().forEach((t) => {
          t.enabled = !callState.muted;
        });
        btnMute.textContent = callState.muted ? "🔇 Unmute" : "🎤 Mute";
      });

