import { useEffect, useState } from "react";
import apiClient from "../apiClient";
import {
  FaPhoneAlt,
  FaPhoneVolume,
  FaClock,
  FaRedoAlt,
  FaUser,
} from "react-icons/fa";

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return "0s";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const CallHistory = ({ currentUser, onStartCall }) => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;

    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get("/user/call-history");
        if (!ignore && res.data?.success) {
          setCalls(res.data.calls || []);
        }
      } catch (err) {
        console.warn("Could not load call history:", err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchHistory();

    return () => {
      ignore = true;
    };
  }, []);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/user/call-history");
      if (res.data?.success) {
        setCalls(res.data.calls || []);
      }
    } catch (err) {
      console.warn("Could not reload call history:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FaClock className="text-purple-400" />
          <h3 className="text-lg font-bold text-white">Recent Calls</h3>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition cursor-pointer p-1 rounded"
          title="Refresh History"
        >
          <FaRedoAlt className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {loading && calls.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
          <FaRedoAlt className="animate-spin text-purple-400" />
          <span>Loading call logs...</span>
        </div>
      ) : calls.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">
          <p>No call history yet.</p>
          <p className="text-xs text-gray-500 mt-1">Start a video call with a user to see logs here!</p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {calls.map((call, index) => {
            const isOutgoing = call.caller?._id?.toString() === currentUser?._id?.toString();
            const partner = isOutgoing ? call.receiver : call.caller;
            const partnerName = partner?.username || partner?.fullname || "Unknown User";

            return (
              <div
                key={call._id || `call-${index}`}
                className="flex items-center justify-between p-3 rounded-xl bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 transition group"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden border border-gray-600 flex items-center justify-center shrink-0">
                    {partner?.profilepic ? (
                      <img
                        src={partner.profilepic}
                        alt={partnerName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FaUser className="text-gray-400 text-xs" />
                    )}
                  </div>

                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white">{partnerName}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          call.status === "connected"
                            ? "bg-green-500/20 text-green-400"
                            : call.status === "rejected" || call.status === "cancelled"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {call.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        {isOutgoing ? (
                          <FaPhoneVolume className="text-blue-400 text-[10px]" />
                        ) : (
                          <FaPhoneAlt className="text-green-400 text-[10px]" />
                        )}
                        {isOutgoing ? "Outgoing" : "Incoming"}
                      </span>
                      <span>·</span>
                      <span>{formatDate(call.createdAt || call.startedAt)}</span>
                      {call.duration > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-gray-300 font-mono">
                            {formatDuration(call.duration)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Call Back Action */}
                {partner?._id && (
                  <button
                    type="button"
                    onClick={() => onStartCall({ userId: partner._id, ...partner })}
                    className="p-2 rounded-lg bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white transition cursor-pointer shadow-xs"
                    title={`Call ${partnerName}`}
                  >
                    <FaPhoneAlt className="text-sm" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CallHistory;
