import { useEffect, useState, useRef } from "react";
import { FaGlobeAmericas, FaTimes, FaForward } from "react-icons/fa";

const RandomMatchModal = ({ socket, currentUser, onStartMatchedCall, onClose }) => {
  const [isSearching, setIsSearching] = useState(true);
  const hasEmitted = useRef(false);

  useEffect(() => {
    if (!socket || !currentUser || hasEmitted.current) return;

    // Start searching
    socket.emit("find-random-peer", {
      id: currentUser._id,
      name: currentUser.username,
      profilepic: currentUser.profilepic || "",
    });
    hasEmitted.current = true;

    const handleMatchFound = (data) => {
      console.log("[Matchmaking] Match found!", data);
      setIsSearching(false);
      onStartMatchedCall(data.partner, data.isInitiator);
    };

    socket.on("random-match-found", handleMatchFound);

    return () => {
      socket.off("random-match-found", handleMatchFound);
      socket.emit("leave-random-queue");
    };
  }, [socket, currentUser, onStartMatchedCall]);

  const handleNextMatch = () => {
    setIsSearching(true);
    socket.emit("leave-random-queue");
    socket.emit("find-random-peer", {
      id: currentUser._id,
      name: currentUser.username,
      profilepic: currentUser.profilepic || "",
    });
  };

  const handleCancel = () => {
    socket?.emit("leave-random-queue");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-gradient-to-b from-gray-900 via-gray-900 to-black border border-purple-500/30 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center overflow-hidden">
        
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={handleCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-full cursor-pointer transition"
          title="Cancel"
        >
          <FaTimes />
        </button>

        {/* Radar Scanning Visual */}
        <div className="relative w-36 h-36 my-6 flex items-center justify-center">
          {/* Radar Circles */}
          <div className="absolute inset-0 rounded-full border border-purple-500/20" />
          <div className="absolute inset-4 rounded-full border border-purple-500/30" />
          <div className="absolute inset-8 rounded-full border border-purple-500/40" />
          
          {/* Pulsing Scan Waves */}
          {isSearching && (
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-500/20 to-blue-500/20 animate-ping" />
          )}

          {/* Center Globe Icon */}
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 shadow-xl flex items-center justify-center text-2xl text-white">
            <FaGlobeAmericas className={isSearching ? "animate-spin" : ""} />
          </div>
        </div>

        {/* Text Details */}
        <h3 className="text-2xl font-extrabold text-white mb-1">
          Global Random Match
        </h3>
        <p className="text-xs text-purple-400 font-medium tracking-wide mb-6">
          {isSearching
            ? "Scanning worldwide for an available stranger..."
            : "Connecting to matched peer..."}
        </p>

        {/* Instructions */}
        <div className="bg-gray-800/60 border border-gray-700/40 rounded-2xl p-3.5 text-xs text-gray-400 mb-6 text-left space-y-1.5 w-full">
          <p className="flex items-center gap-1.5 text-gray-300 font-semibold">
            <span>✨</span> How it works:
          </p>
          <p>• You will be automatically paired with the next available person online.</p>
          <p>• Your video and audio connect directly peer-to-peer with zero middleman.</p>
          <p>• Click <strong>"Skip & Next"</strong> anytime to switch partners!</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 py-3 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-300 font-semibold text-xs transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleNextMatch}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 active:scale-95 text-white font-semibold text-xs shadow-lg shadow-purple-600/30 transition cursor-pointer"
          >
            <FaForward />
            <span>Skip & Next</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default RandomMatchModal;
