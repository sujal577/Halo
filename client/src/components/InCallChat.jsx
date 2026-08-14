import { useState, useEffect, useRef } from "react";
import { FaPaperPlane, FaTimes, FaComments } from "react-icons/fa";

const InCallChat = ({ socket, currentUser, partner, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef(null);

  const partnerId = partner?.userId || partner?._id || partner?.from;

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Listen for incoming call messages
  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          text: data.text,
          senderName: data.senderName,
          from: data.from,
          time: data.time,
          isSelf: false,
        },
      ]);
    };

    socket.on("call-message", handleIncomingMessage);

    return () => {
      socket.off("call-message", handleIncomingMessage);
    };
  }, [socket]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !socket || !currentUser || !partnerId) return;

    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Emit to partner
    socket.emit("call-message", {
      to: partnerId,
      from: currentUser._id,
      senderName: currentUser.username,
      text: inputMessage.trim(),
      time,
    });

    // Add to local state
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: inputMessage.trim(),
        senderName: currentUser.username,
        from: currentUser._id,
        time,
        isSelf: true,
      },
    ]);

    setInputMessage("");
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 z-40 w-full sm:w-80 bg-gray-900/95 border-l border-white/10 shadow-2xl backdrop-blur-xl flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-800 bg-gray-900/80">
        <div className="flex items-center gap-2">
          <FaComments className="text-purple-400" />
          <h3 className="font-bold text-sm text-white">In-Call Messages</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-white rounded-lg cursor-pointer transition"
          title="Close Chat"
        >
          <FaTimes />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 text-xs py-8">
            <FaComments className="text-3xl text-gray-600 mb-2" />
            <p>No messages yet.</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Send a message to your peer during the call!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.isSelf ? "items-end" : "items-start"}`}
            >
              <span className="text-[10px] text-gray-400 px-1 mb-0.5">
                {msg.isSelf ? "You" : msg.senderName} · {msg.time}
              </span>
              <div
                className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs break-words shadow-xs ${
                  msg.isSelf
                    ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-br-xs"
                    : "bg-gray-800 text-gray-200 border border-gray-700/60 rounded-bl-xs"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 border-t border-gray-800 bg-gray-900 flex items-center gap-2"
      >
        <input
          type="text"
          placeholder="Type a message..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          className="flex-1 px-3.5 py-2 rounded-xl bg-gray-800 text-xs text-white placeholder-gray-400 border border-gray-700 focus:border-purple-500 focus:outline-none transition"
        />
        <button
          type="submit"
          disabled={!inputMessage.trim()}
          className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition cursor-pointer shrink-0"
          title="Send"
        >
          <FaPaperPlane className="text-xs" />
        </button>
      </form>
    </div>
  );
};

export default InCallChat;
