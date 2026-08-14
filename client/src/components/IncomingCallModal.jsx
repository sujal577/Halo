import { FaPhoneAlt, FaPhoneSlash } from "react-icons/fa";

const IncomingCallModal = ({ caller, onAnswer, onReject }) => {
  if (!caller) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-sm bg-gradient-to-b from-gray-900 via-gray-900 to-black border border-purple-500/30 rounded-3xl p-8 shadow-2xl shadow-purple-500/10 flex flex-col items-center text-center overflow-hidden">
        
        {/* Animated Glow Rings */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-purple-600/20 rounded-full blur-2xl pointer-events-none" />

        {/* Pulsing Avatar */}
        <div className="relative mb-6">
          <div className="absolute -inset-3 rounded-full bg-green-500/20 animate-ping" />
          <div className="relative w-28 h-28 rounded-full border-4 border-purple-500/60 p-1 bg-gray-800 shadow-2xl overflow-hidden flex items-center justify-center">
            {caller.profilepic ? (
              <img
                src={caller.profilepic}
                alt={caller.name || "Caller"}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-3xl font-bold text-white">
                {(caller.name || "C")[0].toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Caller Details */}
        <h3 className="text-2xl font-bold text-white mb-1">
          {caller.name || "Incoming Caller"}
        </h3>
        {caller.email && (
          <p className="text-xs text-gray-400 mb-2 truncate max-w-[240px]">
            {caller.email}
          </p>
        )}
        <p className="text-sm font-semibold text-green-400 flex items-center justify-center gap-2 mb-8 animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span>
          Incoming Video Call...
        </p>

        {/* Action Buttons: Accept & Decline */}
        <div className="flex items-center justify-center gap-8 w-full">
          {/* Decline (Red) */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onReject}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-red-600/40 cursor-pointer transition-all hover:scale-105"
              title="Decline Call"
            >
              <FaPhoneSlash className="text-2xl" />
            </button>
            <span className="text-xs text-gray-400 font-medium">Decline</span>
          </div>

          {/* Accept (Green) */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onAnswer}
              className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-green-600/40 cursor-pointer transition-all hover:scale-105 animate-bounce"
              title="Accept Video Call"
            >
              <FaPhoneAlt className="text-2xl" />
            </button>
            <span className="text-xs text-gray-400 font-medium">Accept</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default IncomingCallModal;
