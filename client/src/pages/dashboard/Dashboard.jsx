import { useEffect, useState, useRef } from "react";
import {
  FaBars,
  FaDoorClosed,
  FaTimes,
  FaVideo,
  FaUser,
  FaPhoneAlt,
  FaCircle,
  FaPlus,
  FaKey,
  FaGlobeAmericas,
} from "react-icons/fa";
import apiClient from "../../apiClient";
import { useUser } from "../../context/UserContextApi";
import { useNavigate } from "react-router-dom";
import SocketContext from "../socket/SocketContext";
import { useWebRTC } from "../../hooks/useWebRTC";
import CallingModal from "../../components/CallingModal";
import IncomingCallModal from "../../components/IncomingCallModal";
import VideoModal from "../../components/VideoModal";
import CallHistory from "../../components/CallHistory";
import RandomMatchModal from "../../components/RandomMatchModal";
import toast from "react-hot-toast";

function Dashboard() {
  const { user, updateUser } = useUser();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isRandomMatchOpen, setIsRandomMatchOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [isJoinCodeModalOpen, setIsJoinCodeModalOpen] = useState(false);
  const hasJoined = useRef(false);

  const socket = SocketContext.getSocket();

  // Initialize WebRTC hook
  const {
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
  } = useWebRTC(socket, user);

  // Socket join & online users synchronization
  useEffect(() => {
    if (user && socket && !hasJoined.current) {
      socket.emit("join", {
        id: user._id,
        name: user.username,
        profilepic: user.profilepic,
      });
      hasJoined.current = true;
    }

    const handleOnlineUsers = (usersList) => {
      setOnlineUsers(usersList);
    };

    socket?.on("online-users", handleOnlineUsers);

    return () => {
      socket?.off("online-users", handleOnlineUsers);
    };
  }, [user, socket]);

  // Fetch all registered users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await apiClient.get("/user");
        if (response.data.success !== false) {
          const fetchedUsers = response.data.users || [];
          setUsers(fetchedUsers);
          setSelectedUser((prev) => (prev ? prev : fetchedUsers[0] || null));
        }
      } catch (error) {
        console.error("Failed to fetch users", error);
      }
    };

    fetchUsers();
  }, []);

  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout");
      socket?.disconnect();
      SocketContext.setSocket();
      updateUser(null);
      localStorage.removeItem("userData");
      navigate("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const isOnlineUser = (userId) =>
    onlineUsers.some((u) => u.userId === userId || u.userId === userId?.toString());

  const filteredUsers = users.filter(
    (u) =>
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.fullname?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartCallWith = (target) => {
    startCall({
      userId: target._id || target.userId,
      name: target.username || target.name,
      email: target.email,
      profilepic: target.profilepic,
    });
  };

  // 1-Click Instant Meeting
  const handleCreateInstantMeeting = () => {
    const randomCode = `meet-${Math.random().toString(36).substring(2, 8)}`;
    navigate(`/room/${randomCode}`);
  };

  // Join Room by Code
  const handleJoinWithCode = (e) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    const cleanCode = joinCodeInput.trim().replace(/^.*\/room\//, "");
    setIsJoinCodeModalOpen(false);
    navigate(`/room/${cleanCode}`);
  };

  // Handle Random Match Start
  const handleStartMatchedCall = (partner, isInitiator) => {
    setIsRandomMatchOpen(false);
    toast.success(`Matched with ${partner.name || "a peer"}!`);
    if (isInitiator) {
      startCall({
        userId: partner.userId,
        name: partner.name,
        profilepic: partner.profilepic,
      });
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100 font-sans antialiased">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`bg-gray-900 border-r border-gray-800 w-72 h-screen p-5 flex flex-col fixed z-30 transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center text-white shadow-md">
              <FaVideo className="text-sm" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              Peers
            </h1>
          </div>
          <button
            type="button"
            className="md:hidden text-gray-400 hover:text-white p-1 rounded cursor-pointer"
            onClick={() => setIsSidebarOpen(false)}
          >
            <FaTimes />
          </button>
        </div>

        {/* User Search */}
        <div className="my-4">
          <input
            type="text"
            placeholder="Search peers by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-gray-800/80 text-sm text-white placeholder-gray-400 border border-gray-700/60 focus:border-purple-500 focus:outline-none transition"
          />
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {filteredUsers.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-6">
              {searchQuery ? "No users match your search" : "No other users found"}
            </p>
          ) : (
            filteredUsers.map((u) => {
              const online = isOnlineUser(u._id);
              const isSelected = selectedUser?._id === u._id;

              return (
                <div
                  key={u._id}
                  onClick={() => setSelectedUser(u)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition group border ${
                    isSelected
                      ? "bg-purple-600/20 border-purple-500/50 shadow-xs"
                      : "bg-gray-800/40 hover:bg-gray-800/80 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden border border-gray-600 flex items-center justify-center">
                        {u.profilepic ? (
                          <img
                            src={u.profilepic}
                            alt={u.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FaUser className="text-gray-400 text-xs" />
                        )}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${
                          online ? "bg-green-500" : "bg-gray-500"
                        }`}
                        title={online ? "Online" : "Offline"}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-white truncate group-hover:text-purple-300 transition">
                        {u.username}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate max-w-[120px]">
                        {u.email}
                      </p>
                    </div>
                  </div>

                  {/* 1-Click Call Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartCallWith(u);
                    }}
                    className={`p-2 rounded-lg transition cursor-pointer shrink-0 ${
                      online
                        ? "bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white"
                        : "bg-gray-700/50 text-gray-400 hover:bg-purple-600 hover:text-white"
                    }`}
                    title={`Call ${u.username}`}
                  >
                    <FaPhoneAlt className="text-xs" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Current User & Logout */}
        {user && (
          <div className="pt-3 border-t border-gray-800 mt-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-purple-700/50 overflow-hidden border border-purple-400/40 flex items-center justify-center shrink-0">
                {user.profilepic ? (
                  <img
                    src={user.profilepic}
                    alt={user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FaUser className="text-white text-xs" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{user.username}</p>
                <span className="flex items-center gap-1 text-[10px] text-green-400">
                  <FaCircle className="text-[6px]" /> Online
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
              title="Logout"
            >
              <FaDoorClosed className="text-sm" />
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:ml-72 min-h-screen">
        {/* Mobile Header Toggle */}
        <div className="flex items-center justify-between mb-6 md:hidden">
          <button
            type="button"
            className="p-2.5 rounded-xl bg-gray-800 text-gray-300 hover:text-white cursor-pointer"
            onClick={() => setIsSidebarOpen(true)}
          >
            <FaBars className="text-lg" />
          </button>
          <div className="flex items-center gap-2">
            <FaVideo className="text-purple-400" />
            <span className="font-bold text-lg">P2P Calls</span>
          </div>
        </div>

        {/* Global Quick Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Create Instant Meeting */}
          <button
            type="button"
            onClick={handleCreateInstantMeeting}
            className="flex items-center gap-3.5 p-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/20 transition cursor-pointer text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition">
              <FaPlus />
            </div>
            <div>
              <p className="font-bold text-sm">New Meeting</p>
              <p className="text-[11px] text-purple-100">Create instant shareable link</p>
            </div>
          </button>

          {/* Join with Code */}
          <button
            type="button"
            onClick={() => setIsJoinCodeModalOpen(true)}
            className="flex items-center gap-3.5 p-4 rounded-2xl bg-gray-900 hover:bg-gray-850 border border-gray-800 text-white shadow-md transition cursor-pointer text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition">
              <FaKey />
            </div>
            <div>
              <p className="font-bold text-sm">Join with Code</p>
              <p className="text-[11px] text-gray-400">Enter a meeting ID or link</p>
            </div>
          </button>

          {/* Random Global Match */}
          <button
            type="button"
            onClick={() => setIsRandomMatchOpen(true)}
            className="flex items-center gap-3.5 p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/20 transition cursor-pointer text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition">
              <FaGlobeAmericas />
            </div>
            <div>
              <p className="font-bold text-sm">Random Match</p>
              <p className="text-[11px] text-emerald-100">Talk to anyone worldwide</p>
            </div>
          </button>
        </div>

        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900/60 via-blue-900/40 to-gray-900 border border-purple-500/20 p-6 md:p-8 mb-8 shadow-2xl backdrop-blur-md">
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold mb-3">
              ⚡ WebRTC P2P High Definition
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-2">
              Hey, {user?.username || "Friend"}! 👋
            </h1>
            <p className="text-gray-300 text-sm md:text-base leading-relaxed">
              Connect in direct real-time audio, video, and text chat with end-to-end peer encryption.
              Select any contact below or create a shareable room link to invite friends.
            </p>
          </div>

          <div className="absolute -right-16 -top-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Grid: Selected User Call Card & Call History */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Selected Peer Call Action Card (1 Col) */}
          <div className="lg:col-span-1 bg-gray-900/80 border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            {selectedUser ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Selected Contact
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                      isOnlineUser(selectedUser._id)
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-gray-700/50 text-gray-400"
                    }`}
                  >
                    <FaCircle className="text-[6px]" />
                    {isOnlineUser(selectedUser._id) ? "Available" : "Offline"}
                  </span>
                </div>

                <div className="flex flex-col items-center text-center my-4">
                  <div className="w-20 h-20 rounded-2xl bg-gray-800 border-2 border-purple-500/30 p-0.5 overflow-hidden shadow-lg mb-3">
                    {selectedUser.profilepic ? (
                      <img
                        src={selectedUser.profilepic}
                        alt={selectedUser.username}
                        className="w-full h-full rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-2xl font-bold text-white">
                        {selectedUser.username[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-0.5">
                    {selectedUser.username}
                  </h3>
                  <p className="text-xs text-gray-400">{selectedUser.email}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartCallWith(selectedUser)}
                  className="w-full mt-4 flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 active:scale-[0.98] text-white font-semibold shadow-lg shadow-green-600/30 transition cursor-pointer"
                >
                  <FaVideo className="text-base" />
                  <span>Start Video Call</span>
                </button>
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500 text-sm">
                Select a user from the sidebar to start a call.
              </div>
            )}
          </div>

          {/* Call History (2 Cols) */}
          <div className="lg:col-span-2">
            <CallHistory currentUser={user} onStartCall={handleStartCallWith} />
          </div>
        </div>
      </main>

      {/* 🔑 Join with Code Modal */}
      {isJoinCodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-white">Join Meeting</h3>
              <button
                type="button"
                onClick={() => setIsJoinCodeModalOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleJoinWithCode} className="space-y-4">
              <input
                type="text"
                placeholder="e.g. meet-xyz-123 or paste full link"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-800 text-sm text-white placeholder-gray-500 border border-gray-700 focus:border-purple-500 focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsJoinCodeModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-800 text-xs font-semibold text-gray-300 hover:bg-gray-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-md shadow-purple-600/30 cursor-pointer"
                >
                  Join Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🎲 Random Match Modal */}
      {isRandomMatchOpen && (
        <RandomMatchModal
          socket={socket}
          currentUser={user}
          onStartMatchedCall={handleStartMatchedCall}
          onClose={() => setIsRandomMatchOpen(false)}
        />
      )}

      {/* 📞 Outgoing Call Modal */}
      {callStatus === "calling" && (
        <CallingModal
          callee={calleeInfo}
          localStream={localStream}
          onCancel={cancelCall}
        />
      )}

      {/* 📲 Incoming Call Modal */}
      {callStatus === "incoming" && (
        <IncomingCallModal
          caller={callerInfo}
          onAnswer={answerCall}
          onReject={rejectCall}
        />
      )}

      {/* 🎥 Active Video Call Modal */}
      {callStatus === "connected" && (
        <VideoModal
          localStream={localStream}
          remoteStream={remoteStream}
          partner={calleeInfo || callerInfo}
          currentUser={user}
          socket={socket}
          isMicMuted={isMicMuted}
          isVideoOff={isVideoOff}
          isScreenSharing={isScreenSharing}
          callDuration={callDuration}
          onToggleMic={toggleMic}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={toggleScreenShare}
          onEndCall={endCall}
        />
      )}
    </div>
  );
}

export default Dashboard;