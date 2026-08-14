import { useRef, useEffect } from "react";
import { FaPhoneSlash, FaVideo } from "react-icons/fa";

const CallingModal = ({ callee, localStream, onCancel }) => {
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  if (!callee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center overflow-hidden">
        
        {/* Decorative background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Pulsing Avatar Container */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
          <div className="relative w-28 h-28 rounded-full border-4 border-blue-400/40 p-1 bg-gray-800 shadow-xl overflow-hidden flex items-center justify-center">
            {callee.profilepic ? (
              <img
                src={callee.profilepic}
                alt={callee.name || callee.username}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-3xl font-bold text-white">
                {(callee.name || callee.username || "U")[0].toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Callee Info */}
        <h3 className="text-2xl font-bold text-white mb-1">
          {callee.name || callee.username}
        </h3>
        <p className="text-sm text-blue-400 font-medium tracking-wide animate-pulse mb-6">
          Calling...
        </p>

        {/* Local Video Camera Preview */}
        <div className="relative w-full h-36 bg-black/60 rounded-2xl overflow-hidden border border-gray-800 mb-6 flex items-center justify-center">
          {localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
            />
          ) : (
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              <FaVideo className="animate-spin text-blue-400" />
              <span>Starting camera preview...</span>
            </div>
          )}
          <span className="absolute bottom-2 left-2 text-[10px] bg-black/70 px-2 py-0.5 rounded text-gray-300">
            Your Camera
          </span>
        </div>

        {/* Cancel Action */}
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-3 px-8 py-3.5 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white font-semibold transition shadow-lg shadow-red-600/30 cursor-pointer"
        >
          <FaPhoneSlash className="text-lg" />
          <span>Cancel Call</span>
        </button>
      </div>
    </div>
  );
};

export default CallingModal;
