import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaDesktop,
  FaPhoneSlash,
  FaCopy,
  FaCheck,
  FaComments,
  FaUser,
  FaExpand,
  FaCompress,
} from "react-icons/fa";
import toast from "react-hot-toast";
import { useUser } from "../../context/UserContextApi";
import SocketContext from "../socket/SocketContext";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
  ],
};

function RoomCall() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const socket = SocketContext.getSocket();

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [partnerName, setPartnerName] = useState("Waiting for participant...");
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const originalVideoTrackRef = useRef(null);
  const containerRef = useRef(null);

  // Copy Meeting URL to clipboard
  const handleCopyLink = () => {
    const meetingUrl = window.location.href;
    navigator.clipboard.writeText(meetingUrl).then(() => {
      setCopied(true);
      toast.success("Meeting link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // Clean up media and peer connections
  const cleanup = useCallback(() => {
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
        pcRef.current.close();
      } catch {
        // ignore
      }
      pcRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  // Request user camera and microphone
  const initLocalMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
      } catch (err) {
        toast.error("Please grant camera and microphone permissions.");
        throw err;
      }
    }
  }, []);

  // Initialize Room & WebRTC
  useEffect(() => {
    if (!socket || !user || !roomId) return;

    let localMediaStream = null;

    const setupRoom = async () => {
      try {
        localMediaStream = await initLocalMedia();

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        // Attach local tracks
        localMediaStream.getTracks().forEach((track) => {
          pc.addTrack(track, localMediaStream);
        });

        // Remote track arrival
        pc.ontrack = (event) => {
          console.log("[Room WebRTC] Received remote stream track");
          const [incoming] = event.streams;
          if (incoming) {
            setRemoteStream(incoming);
          }
        };

        // ICE candidate exchange
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("room-signal", {
              toSocketId: pcRef.current?.targetSocketId,
              signal: { type: "candidate", candidate: event.candidate },
              fromUser: { username: user.username, profilepic: user.profilepic },
            });
          }
        };

        // Join room on server
        socket.emit("join-room", {
          roomId,
          user: { id: user._id, name: user.username, profilepic: user.profilepic },
        });

        // Listen for new user joining room
        socket.on("user-joined-room", async ({ socketId, user: joiningUser }) => {
          toast.success(`${joiningUser?.name || "A participant"} joined the room!`);
          setPartnerName(joiningUser?.name || "Participant");
          pc.targetSocketId = socketId;

          // Create offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          socket.emit("room-signal", {
            toSocketId: socketId,
            signal: offer,
            fromUser: { username: user.username, profilepic: user.profilepic },
          });
        });

        // Listen for room signals (Offer, Answer, ICE candidates)
        socket.on("room-signal", async ({ fromSocketId, signal, fromUser }) => {
          if (fromUser?.username) setPartnerName(fromUser.username);
          pc.targetSocketId = fromSocketId;

          if (signal.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit("room-signal", {
              toSocketId: fromSocketId,
              signal: answer,
              fromUser: { username: user.username, profilepic: user.profilepic },
            });
          } else if (signal.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
          } else if (signal.type === "candidate" && signal.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (err) {
              console.warn("Error adding room candidate:", err);
            }
          }
        });

        // Listen for user leaving room
        socket.on("user-left-room", () => {
          toast("Participant left the room.");
          setRemoteStream(null);
          setPartnerName("Waiting for participant...");
        });

        // Room Chat Messages
        socket.on("room-message", (msg) => {
          setMessages((prev) => [...prev, msg]);
        });
      } catch (err) {
        console.error("Room init error:", err);
      }
    };

    setupRoom();

    return () => {
      cleanup();
      socket.off("user-joined-room");
      socket.off("room-signal");
      socket.off("user-left-room");
      socket.off("room-message");
    };
  }, [socket, user, roomId, initLocalMedia, cleanup]);

  // Attach local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote video stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Controls
  const toggleMic = () => {
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getAudioTracks();
      if (tracks.length > 0) {
        tracks[0].enabled = !tracks[0].enabled;
        setIsMicMuted(!tracks[0].enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getVideoTracks();
      if (tracks.length > 0) {
        tracks[0].enabled = !tracks[0].enabled;
        setIsVideoOff(!tracks[0].enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!pcRef.current || !localStreamRef.current) return;

    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const currentTrack = localStreamRef.current.getVideoTracks()[0];
        originalVideoTrackRef.current = currentTrack;

        const senders = pcRef.current.getSenders();
        const sender = senders.find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);

        localStreamRef.current.removeTrack(currentTrack);
        localStreamRef.current.addTrack(screenTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        setIsScreenSharing(true);

        screenTrack.onended = () => {
          if (sender && originalVideoTrackRef.current) {
            sender.replaceTrack(originalVideoTrackRef.current);
            localStreamRef.current.removeTrack(screenTrack);
            localStreamRef.current.addTrack(originalVideoTrackRef.current);
            setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
            setIsScreenSharing(false);
          }
        };
      } catch (err) {
        console.warn("Screen share error:", err);
      }
    } else {
      const senders = pcRef.current.getSenders();
      const sender = senders.find((s) => s.track?.kind === "video");
      if (sender && originalVideoTrackRef.current) {
        sender.replaceTrack(originalVideoTrackRef.current);
        const currentTrack = localStreamRef.current.getVideoTracks()[0];
        if (currentTrack) currentTrack.stop();
        localStreamRef.current.removeTrack(currentTrack);
        localStreamRef.current.addTrack(originalVideoTrackRef.current);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }
      setIsScreenSharing(false);
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket || !user) return;

    socket.emit("room-message", {
      roomId,
      text: chatInput.trim(),
      senderName: user.username,
      from: user._id,
    });
    setChatInput("");
  };

  const handleLeaveRoom = () => {
    cleanup();
    navigate("/");
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-screen bg-gray-950 text-white select-none overflow-hidden"
    >
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-gray-900/80 border-b border-gray-800 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            <span className="font-bold text-sm text-white">Room: {roomId}</span>
          </div>

          {/* Copy Link Button */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-purple-300 border border-gray-700 transition cursor-pointer"
            title="Copy Invite Link"
          >
            {copied ? <FaCheck className="text-green-400" /> : <FaCopy />}
            <span>{copied ? "Link Copied!" : "Copy Invite Link"}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* In-Room Chat Toggle */}
          <button
            type="button"
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-2.5 rounded-full transition cursor-pointer ${
              isChatOpen ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-300 hover:text-white"
            }`}
            title="In-Room Chat"
          >
            <FaComments />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-full bg-gray-800 text-gray-300 hover:text-white transition cursor-pointer"
          >
            {isFullscreen ? <FaCompress /> : <FaExpand />}
          </button>
        </div>
      </header>

      {/* Main Video Grid */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center bg-black overflow-hidden">
        {/* Remote Video */}
        {remoteStream && remoteStream.getVideoTracks().length > 0 ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-center p-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-purple-700 to-blue-600 flex items-center justify-center text-4xl font-bold shadow-2xl animate-pulse">
              <FaUser />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-white">{partnerName}</h3>
              <p className="text-xs text-gray-400">Share your invite link with anyone to join!</p>
            </div>
          </div>
        )}

        {/* Floating Local Camera PiP */}
        <div
          className={`absolute bottom-24 z-20 w-44 md:w-56 aspect-video bg-gray-900 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl transition-all ${
            isChatOpen ? "right-84" : "right-6"
          }`}
        >
          {localStream && !isVideoOff ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-400 gap-1">
              <FaVideoSlash />
              <span className="text-[10px]">Camera Off</span>
            </div>
          )}
          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-gray-300">
            You {isMicMuted ? "(Muted)" : ""}
          </span>
        </div>

        {/* In-Room Chat Drawer */}
        {isChatOpen && (
          <div className="absolute right-0 top-0 bottom-0 z-30 w-80 bg-gray-900/95 border-l border-gray-800 shadow-2xl flex flex-col backdrop-blur-xl">
            <div className="px-4 py-3 border-b border-gray-800 font-bold text-sm text-white">
              Room Chat
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar">
              {messages.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">No messages in room yet.</p>
              ) : (
                messages.map((m, idx) => (
                  <div key={idx} className="flex flex-col">
                    <span className="text-[10px] text-gray-400 mb-0.5">
                      {m.senderName} · {m.time}
                    </span>
                    <div className="bg-gray-800 border border-gray-700/60 p-2.5 rounded-xl text-xs text-gray-200 break-words">
                      {m.text}
                    </div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleSendChat} className="p-3 border-t border-gray-800 flex gap-2">
              <input
                type="text"
                placeholder="Message room..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-gray-800 text-xs text-white border border-gray-700 focus:outline-none"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 px-6 py-3.5 bg-gray-900/85 hover:bg-gray-900/95 border border-white/10 rounded-full shadow-2xl backdrop-blur-xl transition-all">
        {/* Mic Toggle */}
        <button
          type="button"
          onClick={toggleMic}
          className={`p-4 rounded-full transition-all active:scale-90 cursor-pointer shadow-md ${
            isMicMuted
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
          title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
        >
          {isMicMuted ? <FaMicrophoneSlash className="text-xl" /> : <FaMicrophone className="text-xl" />}
        </button>

        {/* Video Toggle */}
        <button
          type="button"
          onClick={toggleVideo}
          className={`p-4 rounded-full transition-all active:scale-90 cursor-pointer shadow-md ${
            isVideoOff
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
          title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
        >
          {isVideoOff ? <FaVideoSlash className="text-xl" /> : <FaVideo className="text-xl" />}
        </button>

        {/* Screen Share */}
        <button
          type="button"
          onClick={toggleScreenShare}
          className={`p-4 rounded-full transition-all active:scale-90 cursor-pointer shadow-md ${
            isScreenSharing
              ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/30"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
          title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
        >
          <FaDesktop className="text-xl" />
        </button>

        {/* Leave Room */}
        <button
          type="button"
          onClick={handleLeaveRoom}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 active:scale-90 text-white transition-all cursor-pointer shadow-lg shadow-red-600/40"
          title="Leave Room"
        >
          <FaPhoneSlash className="text-xl" />
        </button>
      </div>
    </div>
  );
}

export default RoomCall;
