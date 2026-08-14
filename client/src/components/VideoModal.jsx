import { useRef, useEffect, useState } from "react";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaDesktop,
  FaPhoneSlash,
  FaExpand,
  FaCompress,
  FaUser,
  FaComments,
} from "react-icons/fa";
import InCallChat from "./InCallChat";

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const VideoModal = ({
  localStream,
  remoteStream,
  partner,
  currentUser,
  socket,
  isMicMuted,
  isVideoOff,
  isScreenSharing,
  callDuration,
  onToggleMic,
  onToggleVideo,
  onToggleScreenShare,
  onEndCall,
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const modalContainerRef = useRef(null);

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalContainerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const partnerName = partner?.name || partner?.username || "Remote User";

  return (
    <div
      ref={modalContainerRef}
      className="fixed inset-0 z-50 flex flex-col bg-gray-950 text-white select-none overflow-hidden animate-fade-in"
    >
      {/* Top Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-600/60 overflow-hidden border border-purple-400/40 flex items-center justify-center">
            {partner?.profilepic ? (
              <img
                src={partner.profilepic}
                alt={partnerName}
                className="w-full h-full object-cover"
              />
            ) : (
              <FaUser className="text-white text-sm" />
            )}
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-none mb-1">
              {partnerName}
            </h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-xs text-gray-300 font-mono tracking-wider">
                {formatDuration(callDuration)}
              </span>
              <span className="text-[11px] text-gray-400">· P2P Encrypted</span>
            </div>
          </div>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-2">
          {/* Chat Toggle Top */}
          <button
            type="button"
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-2.5 rounded-full transition cursor-pointer backdrop-blur-md ${
              isChatOpen
                ? "bg-purple-600 text-white"
                : "bg-white/10 hover:bg-white/20 text-gray-200"
            }`}
            title={isChatOpen ? "Close Chat" : "Open In-Call Chat"}
          >
            <FaComments />
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-gray-200 transition cursor-pointer backdrop-blur-md"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <FaCompress /> : <FaExpand />}
          </button>
        </div>
      </div>

      {/* Main Remote Video View */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center bg-black overflow-hidden">
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
              {partnerName[0]?.toUpperCase() || "U"}
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-white">{partnerName}</h3>
              <p className="text-sm text-gray-400">Connected · Audio Only or Waiting for Video Feed</p>
            </div>
          </div>
        )}

        {/* Floating Local Video (Picture-in-Picture) */}
        <div
          className={`absolute bottom-24 z-20 w-44 md:w-56 aspect-video bg-gray-900/90 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl backdrop-blur-md transition-all hover:scale-105 group ${
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
              <FaVideoSlash className="text-xl" />
              <span className="text-[10px]">Camera Off</span>
            </div>
          )}
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-gray-200 font-medium">
            You {isMicMuted ? "(Muted)" : ""}
          </div>
        </div>

        {/* Slide-over In-Call Chat */}
        {isChatOpen && (
          <InCallChat
            socket={socket}
            currentUser={currentUser}
            partner={partner}
            onClose={() => setIsChatOpen(false)}
          />
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 px-6 py-3.5 bg-gray-900/85 hover:bg-gray-900/95 border border-white/10 rounded-full shadow-2xl backdrop-blur-xl transition-all">
        
        {/* Mic Mute / Unmute */}
        <button
          type="button"
          onClick={onToggleMic}
          className={`p-4 rounded-full transition-all active:scale-90 cursor-pointer shadow-md ${
            isMicMuted
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
          title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
        >
          {isMicMuted ? <FaMicrophoneSlash className="text-xl" /> : <FaMicrophone className="text-xl" />}
        </button>

        {/* Video On / Off */}
        <button
          type="button"
          onClick={onToggleVideo}
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
          onClick={onToggleScreenShare}
          className={`p-4 rounded-full transition-all active:scale-90 cursor-pointer shadow-md ${
            isScreenSharing
              ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/30"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
          title={isScreenSharing ? "Stop Screen Sharing" : "Share Screen"}
        >
          <FaDesktop className="text-xl" />
        </button>

        {/* In-Call Chat Toggle */}
        <button
          type="button"
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`p-4 rounded-full transition-all active:scale-90 cursor-pointer shadow-md ${
            isChatOpen
              ? "bg-purple-600 text-white shadow-purple-500/40"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
          title="In-Call Chat"
        >
          <FaComments className="text-xl" />
        </button>

        {/* End Call Button */}
        <button
          type="button"
          onClick={onEndCall}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 active:scale-90 text-white transition-all cursor-pointer shadow-lg shadow-red-600/40 hover:scale-105"
          title="End Video Call"
        >
          <FaPhoneSlash className="text-xl" />
        </button>

      </div>
    </div>
  );
};

export default VideoModal;
