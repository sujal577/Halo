import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import {
  playIncomingRingtone,
  playOutgoingRinging,
  playCallEndedTone,
} from "../utils/soundEffects";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

export const useWebRTC = (socket, currentUser) => {
  const [callStatus, setCallStatus] = useState("idle"); // "idle" | "calling" | "incoming" | "connected" | "ended"
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callerInfo, setCallerInfo] = useState(null);
  const [calleeInfo, setCalleeInfo] = useState(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const iceCandidatesQueue = useRef([]);
  const stopToneRef = useRef(null);
  const originalVideoTrackRef = useRef(null);

  // Stop any active ringtones/dialtones
  const stopSounds = useCallback(() => {
    if (stopToneRef.current) {
      stopToneRef.current();
      stopToneRef.current = null;
    }
  }, []);

  // Clean up all media tracks and connections
  const cleanupMediaAndPeer = useCallback(() => {
    stopSounds();

    if (originalVideoTrackRef.current) {
      originalVideoTrackRef.current.stop();
      originalVideoTrackRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      localStreamRef.current = null;
    }

    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      } catch {
        // ignore
      }
      pcRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    remoteStreamRef.current = null;
    iceCandidatesQueue.current = [];
    setIsScreenSharing(false);
    setIsMicMuted(false);
    setIsVideoOff(false);
    setCallDuration(0);
  }, [stopSounds]);

  // Request user camera & audio
  const getMedia = useCallback(async () => {
    try {
      if (localStreamRef.current) {
        return localStreamRef.current;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.warn("Could not get HD video, falling back to basic media", err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
      } catch (fallbackErr) {
        toast.error("Camera or Microphone access denied. Please grant permissions.");
        throw fallbackErr;
      }
    }
  }, []);

  // Create and configure RTCPeerConnection
  const createPeerConnection = useCallback(
    (targetUserId) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket && currentUser) {
          socket.emit("ice-candidate", {
            to: targetUserId,
            candidate: event.candidate,
            from: currentUser._id,
          });
        }
      };

      // Handle incoming remote tracks
      pc.ontrack = (event) => {
        console.log("[WebRTC] Received remote track:", event.track.kind);
        const [incomingStream] = event.streams;
        if (incomingStream) {
          remoteStreamRef.current = incomingStream;
          setRemoteStream(incomingStream);
        } else {
          // If stream array is empty, create new MediaStream
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
          }
          remoteStreamRef.current.addTrack(event.track);
          setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("[WebRTC] Connection State:", pc.connectionState);
        if (pc.connectionState === "connected") {
          setCallStatus("connected");
          stopSounds();
        } else if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          if (callStatus === "connected") {
            toast("Connection closed");
            cleanupMediaAndPeer();
            setCallStatus("idle");
          }
        }
      };

      return pc;
    },
    [socket, currentUser, callStatus, cleanupMediaAndPeer, stopSounds]
  );

  // 📞 1. INITIATE OUTGOING CALL
  const startCall = useCallback(
    async (targetUser) => {
      if (!socket || !currentUser) {
        toast.error("Socket not connected");
        return;
      }

      try {
        setCalleeInfo(targetUser);
        setCallStatus("calling");
        setCallDuration(0);
        stopToneRef.current = playOutgoingRinging();

        const stream = await getMedia();
        const pc = createPeerConnection(targetUser.userId || targetUser._id);

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Create and set local offer
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);

        // Send offer to callee via socket
        socket.emit("callToUser", {
          callToUserId: targetUser.userId || targetUser._id,
          signalData: offer,
          from: currentUser._id,
          name: currentUser.username,
          email: currentUser.email,
          profilepic: currentUser.profilepic || "",
        });
      } catch (error) {
        console.error("Failed to start call:", error);
        cleanupMediaAndPeer();
        setCallStatus("idle");
      }
    },
    [socket, currentUser, getMedia, createPeerConnection, cleanupMediaAndPeer]
  );

  // 📞 2. ANSWER INCOMING CALL
  const answerCall = useCallback(async () => {
    if (!callerInfo || !socket || !currentUser) return;

    try {
      stopSounds();
      setCallStatus("connected");
      setCallDuration(0);

      const stream = await getMedia();
      const pc = createPeerConnection(callerInfo.from);

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Set remote offer description
      await pc.setRemoteDescription(new RTCSessionDescription(callerInfo.signal));

      // Process any queued ICE candidates
      while (iceCandidatesQueue.current.length > 0) {
        const candidate = iceCandidatesQueue.current.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn("Error adding queued ICE candidate:", e);
        }
      }

      // Create and set local answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer to caller
      socket.emit("answeredCall", {
        signal: answer,
        to: callerInfo.from,
        from: currentUser._id,
      });
    } catch (error) {
      console.error("Failed to answer call:", error);
      toast.error("Could not establish video connection");
      cleanupMediaAndPeer();
      setCallStatus("idle");
    }
  }, [callerInfo, socket, currentUser, stopSounds, getMedia, createPeerConnection, cleanupMediaAndPeer]);

  // ❌ 3. REJECT INCOMING CALL
  const rejectCall = useCallback(() => {
    if (!callerInfo || !socket || !currentUser) return;
    stopSounds();

    socket.emit("reject-call", {
      to: callerInfo.from,
      from: currentUser._id,
      name: currentUser.username,
      profilepic: currentUser.profilepic || "",
    });

    cleanupMediaAndPeer();
    setCallerInfo(null);
    setCallStatus("idle");
  }, [callerInfo, socket, currentUser, stopSounds, cleanupMediaAndPeer]);

  // 🚫 4. CANCEL OUTGOING CALL
  const cancelCall = useCallback(() => {
    if (!calleeInfo || !socket || !currentUser) return;
    stopSounds();

    socket.emit("cancel-call", {
      to: calleeInfo.userId || calleeInfo._id,
      from: currentUser._id,
    });

    cleanupMediaAndPeer();
    setCalleeInfo(null);
    setCallStatus("idle");
  }, [calleeInfo, socket, currentUser, stopSounds, cleanupMediaAndPeer]);

  // 📴 5. END ACTIVE CALL
  const endCall = useCallback(() => {
    const partnerId = calleeInfo ? calleeInfo.userId || calleeInfo._id : callerInfo?.from;

    if (partnerId && socket && currentUser) {
      socket.emit("call-ended", {
        to: partnerId,
        from: currentUser._id,
        name: currentUser.username,
      });
    }

    playCallEndedTone();
    cleanupMediaAndPeer();
    setCallerInfo(null);
    setCalleeInfo(null);
    setCallStatus("idle");
  }, [calleeInfo, callerInfo, socket, currentUser, cleanupMediaAndPeer]);

  // 🎤 TOGGLE MIC
  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextState = !audioTracks[0].enabled;
        audioTracks.forEach((track) => {
          track.enabled = nextState;
        });
        setIsMicMuted(!nextState);
      }
    }
  }, []);

  // 📷 TOGGLE CAMERA
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextState = !videoTracks[0].enabled;
        videoTracks.forEach((track) => {
          track.enabled = nextState;
        });
        setIsVideoOff(!nextState);
      }
    }
  }, []);

  // 🖥️ TOGGLE SCREEN SHARE
  const toggleScreenShare = useCallback(async () => {
    if (!pcRef.current || !localStreamRef.current) return;

    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
        originalVideoTrackRef.current = currentVideoTrack;

        // Replace track in peer connection
        const senders = pcRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === "video");
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }

        // Replace in local stream
        localStreamRef.current.removeTrack(currentVideoTrack);
        localStreamRef.current.addTrack(screenTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        setIsScreenSharing(true);

        // When user clicks "Stop Sharing" from browser toolbar
        screenTrack.onended = () => {
          if (videoSender && originalVideoTrackRef.current) {
            videoSender.replaceTrack(originalVideoTrackRef.current);
            localStreamRef.current.removeTrack(screenTrack);
            localStreamRef.current.addTrack(originalVideoTrackRef.current);
            setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
            setIsScreenSharing(false);
          }
        };
      } catch (err) {
        console.warn("Screen share cancelled or failed:", err);
      }
    } else {
      // Revert back to webcam
      const senders = pcRef.current.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === "video");

      if (videoSender && originalVideoTrackRef.current) {
        videoSender.replaceTrack(originalVideoTrackRef.current);
        const currentTrack = localStreamRef.current.getVideoTracks()[0];
        if (currentTrack) currentTrack.stop();
        localStreamRef.current.removeTrack(currentTrack);
        localStreamRef.current.addTrack(originalVideoTrackRef.current);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }
      setIsScreenSharing(false);
    }
  }, [isScreenSharing]);

  // Duration Timer
  useEffect(() => {
    if (callStatus === "connected") {
      const interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [callStatus]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming call
    const handleIncomingCall = (data) => {
      console.log("[Socket] Incoming call from:", data.name);
      if (callStatus !== "idle") {
        socket.emit("userBusy", { message: "User is currently busy" });
        return;
      }
      setCallerInfo(data);
      setCallStatus("incoming");
      stopToneRef.current = playIncomingRingtone();
    };

    // Call accepted by callee
    const handleCallAccepted = async (data) => {
      console.log("[Socket] Call accepted by remote peer");
      stopSounds();
      setCallStatus("connected");

      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.signal));
          // Flush any buffered candidates
          while (iceCandidatesQueue.current.length > 0) {
            const candidate = iceCandidatesQueue.current.shift();
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn("Error adding queued ICE candidate:", e);
            }
          }
        } catch (err) {
          console.error("Error setting remote description on caller:", err);
        }
      }
    };

    // ICE Candidate from peer
    const handleIceCandidate = async (data) => {
      if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.warn("Failed to add ICE candidate:", e);
        }
      } else {
        iceCandidatesQueue.current.push(data.candidate);
      }
    };

    // Call rejected
    const handleCallRejected = (data) => {
      toast.error(`${data.name || "User"} declined the call.`);
      cleanupMediaAndPeer();
      setCalleeInfo(null);
      setCallStatus("idle");
    };

    // Call cancelled by caller
    const handleCallCancelled = () => {
      toast("Call was cancelled by the caller.");
      cleanupMediaAndPeer();
      setCallerInfo(null);
      setCallStatus("idle");
    };

    // Call ended
    const handleCallEnded = (data) => {
      toast(`${data.name || "User"} ended the call.`);
      playCallEndedTone();
      cleanupMediaAndPeer();
      setCallerInfo(null);
      setCalleeInfo(null);
      setCallStatus("idle");
    };

    // User busy
    const handleUserBusy = () => {
      toast.error("User is currently in another call.");
      cleanupMediaAndPeer();
      setCalleeInfo(null);
      setCallStatus("idle");
    };

    // User unavailable
    const handleUserUnavailable = () => {
      toast.error("User is currently offline.");
      cleanupMediaAndPeer();
      setCalleeInfo(null);
      setCallStatus("idle");
    };

    socket.on("callToUser", handleIncomingCall);
    socket.on("callAccepted", handleCallAccepted);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("callRejected", handleCallRejected);
    socket.on("callCancelled", handleCallCancelled);
    socket.on("callEnded", handleCallEnded);
    socket.on("userBusy", handleUserBusy);
    socket.on("userUnavailable", handleUserUnavailable);

    return () => {
      socket.off("callToUser", handleIncomingCall);
      socket.off("callAccepted", handleCallAccepted);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("callRejected", handleCallRejected);
      socket.off("callCancelled", handleCallCancelled);
      socket.off("callEnded", handleCallEnded);
      socket.off("userBusy", handleUserBusy);
      socket.off("userUnavailable", handleUserUnavailable);
    };
  }, [socket, callStatus, stopSounds, cleanupMediaAndPeer]);

  return {
    callStatus,
    localStream,
    remoteStream,
    callerInfo,
    calleeInfo,
    isMicMuted,
    isVideoOff,
    isScreenSharing,
    callDuration,
    startCall,
    answerCall,
    rejectCall,
    cancelCall,
    endCall,
    toggleMic,
    toggleVideo,
    toggleScreenShare,
  };
};
