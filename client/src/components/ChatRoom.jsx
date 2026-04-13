import React, { useState, useEffect, useRef } from "react";
import {
  useGetUsersQuery,
  useGetMessagesQuery,
  useUpdateUserMutation,
} from "../store/api";
import { useSocket } from "../hooks/useSocket";
import {
  Send,
  Users,
  Search,
  Smile,
  LogOut,
  Bell,
  Trash2,
  Settings,
  Menu,
  X,
} from "lucide-react";

const ChatRoom = ({ user, onLogout, onUpdateUser }) => {
  const socket = useSocket();
  const [message, setMessage] = useState("");
  const [localMessages, setLocalMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationLog, setNotificationLog] = useState([]);
  const [activeTab, setActiveTab] = useState("users");
  const [unreadCount, setUnreadCount] = useState(0);
  const [clearedAt, setClearedAt] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newUsername, setNewUsername] = useState(user.username);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [updateUserApi] = useUpdateUserMutation();
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        1760,
        audioCtx.currentTime + 0.1,
      );

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime + 0.5,
      );

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.log("Audio play failed:", e);
    }
  };

  const addNotification = (text, type = "info") => {
    const id = Date.now() + Math.random();
    const newNotif = { id, text, type, time: new Date() };

    setNotifications((prev) => [...prev, newNotif]);
    setNotificationLog((prev) => [newNotif, ...prev]);

    // Play sound and update badging
    playNotificationSound();
    setUnreadCount((prev) => {
      // If we're not currently looking at the notifications tab, increment unread count
      if (activeTab !== "notifications") return prev + 1;
      return 0; // If we are looking at it, it stays 0
    });

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3000);
  };

  const { data: users = [], refetch: refetchUsers } = useGetUsersQuery();
  const { data: history = [], isLoading: historyLoading } =
    useGetMessagesQuery();

  const emojis = [
    "😊",
    "😂",
    "😍",
    "👍",
    "🔥",
    "✨",
    "🙌",
    "❤️",
    "🚀",
    "🤔",
    "😢",
    "🎉",
  ];

  useEffect(() => {
    if (socket) {
      socket.emit("user_join", user._id);

      socket.on("receive_message", (newMessage) => {
        setLocalMessages((prev) => [...prev, newMessage]);
        if (newMessage.sender?._id !== user._id) {
          addNotification(
            `New message from ${newMessage.sender?.username}`,
            "info",
          );
        }
      });

      socket.on("user_status_change", (data) => {
        refetchUsers();
        if (data.username && data.userId !== user._id) {
          addNotification(
            `${data.username} is ${data.online ? "online" : "offline"}`,
            data.online ? "success" : "warning",
          );
        }
      });

      socket.on("user_typing_start", (data) => {
        setTypingUsers((prev) => {
          if (prev.find((u) => u.userId === data.userId)) return prev;
          return [...prev, data];
        });
      });

      socket.on("user_typing_stop", (userId) => {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
      });
    }

    return () => {
      if (socket) {
        socket.off("receive_message");
        socket.off("user_status_change");
        socket.off("user_typing_start");
        socket.off("user_typing_stop");
      }
    };
  }, [socket, user._id, refetchUsers]);

  // Clear unread count when switching to notification tab
  useEffect(() => {
    if (activeTab === "notifications") {
      setUnreadCount(0);
    }
  }, [activeTab]);

  useEffect(() => {
    scrollToBottom();
  }, [history, localMessages, typingUsers]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);

    if (!socket) return;

    // Typing logic
    socket.emit("typing_start", { userId: user._id, username: user.username });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing_stop", user._id);
    }, 2000);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;

    socket.emit("send_message", {
      sender: user._id,
      text: message.trim(),
    });

    socket.emit("typing_stop", user._id);
    setMessage("");
    setShowEmojis(false);
  };

  const addEmoji = (emoji) => {
    setMessage((prev) => prev + emoji);
  };

  const getInitials = (name) => {
    return (
      name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "?"
    );
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "Just now";
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const filteredMessages = [...history, ...localMessages].filter((msg) => {
    if (clearedAt && new Date(msg.createdAt || Date.now()) <= clearedAt)
      return false;
    return (
      msg.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.sender?.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <>
      {isEditingProfile && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="glass-container"
            style={{
              padding: "24px",
              width: "300px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <h3 style={{ margin: 0 }}>Edit Profile</h3>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  color: "var(--text-muted)",
                  marginBottom: "8px",
                }}
              >
                Username
              </label>
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="New Username"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button
                onClick={async () => {
                  if (!newUsername.trim() || newUsername === user.username) {
                    setIsEditingProfile(false);
                    return;
                  }
                  try {
                    const updated = await updateUserApi({
                      id: user._id,
                      username: newUsername,
                    }).unwrap();
                    onUpdateUser(updated);
                    setIsEditingProfile(false);
                    if (socket) socket.emit("user_join", updated._id); // Update status globally
                    addNotification("Profile updated successfully", "success");
                  } catch (e) {
                    alert(e.data?.error || "Error updating profile");
                  }
                }}
              >
                Save
              </button>
              <button
                style={{
                  background: "transparent",
                  border: "1px solid var(--glass-border)",
                }}
                onClick={() => {
                  setNewUsername(user.username);
                  setIsEditingProfile(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="toast-container">
        {notifications.map((n) => (
          <div key={n.id} className={`toast ${n.type}`}>
            {n.text}
          </div>
        ))}
      </div>
      <div className="glass-container chat-app">
        {/* Sidebar */}
        <div className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
          <div className="sidebar-header">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <h2
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 800,
                  letterSpacing: "-0.5px",
                }}
              >
                Global Chat
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  className="avatar"
                  style={{
                    width: "32px",
                    height: "32px",
                    fontSize: "0.8rem",
                    margin: 0,
                  }}
                >
                  {getInitials(user.username)}
                </div>
                <button
                  className="mobile-only"
                  onClick={() => setIsSidebarOpen(false)}
                  style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    border: "none",
                    padding: "6px",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  <X size={20} color="var(--text-main)" />
                </button>
              </div>
            </div>
          </div>

          <div className="search-container" style={{ marginTop: "16px" }}>
            <Search className="search-icon" size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--glass-border)",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                flex: 1,
                padding: "12px",
                textAlign: "center",
                cursor: "pointer",
                fontWeight: activeTab === "users" ? 600 : 400,
                borderBottom:
                  activeTab === "users" ? "2px solid var(--primary)" : "none",
                color:
                  activeTab === "users"
                    ? "var(--text-main)"
                    : "var(--text-muted)",
                fontSize: "0.85rem",
                transition: "all 0.2s",
              }}
              onClick={() => setActiveTab("users")}
            >
              <Users
                size={16}
                style={{ marginRight: "6px", verticalAlign: "middle" }}
              />
              Users
            </div>
            <div
              style={{
                flex: 1,
                padding: "12px",
                textAlign: "center",
                cursor: "pointer",
                fontWeight: activeTab === "notifications" ? 600 : 400,
                borderBottom:
                  activeTab === "notifications"
                    ? "2px solid var(--primary)"
                    : "none",
                color:
                  activeTab === "notifications"
                    ? "var(--text-main)"
                    : "var(--text-muted)",
                fontSize: "0.85rem",
                transition: "all 0.2s",
                position: "relative",
              }}
              onClick={() => setActiveTab("notifications")}
            >
              <Bell
                size={16}
                style={{ marginRight: "6px", verticalAlign: "middle" }}
              />
              Activity
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "12px",
                    background: "var(--warning)",
                    color: "#fff",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: "10px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
          </div>

          <div className="user-list">
            {activeTab === "users" ? (
              users.map((u) => (
                <div
                  key={u._id}
                  className={`user-item ${u._id === user._id ? "active" : ""}`}
                >
                  <div className="avatar">{getInitials(u.username)}</div>
                  <div
                    className={`status-dot ${u.online ? "status-online" : "status-offline"}`}
                  />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>
                      {u.username} {u._id === user._id && "(You)"}
                    </span>
                    <span
                      style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}
                    >
                      {u.online ? "Online" : "Offline"}
                    </span>
                  </div>
                </div>
              ))
            ) : notificationLog.length === 0 ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "0.85rem",
                }}
              >
                No recent activity.
              </div>
            ) : (
              notificationLog.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: "12px",
                    borderBottom: "1px solid var(--glass-border)",
                    fontSize: "0.85rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <span
                    style={{
                      color:
                        n.type === "success"
                          ? "var(--success)"
                          : n.type === "warning"
                            ? "var(--warning)"
                            : "var(--info)",
                      fontWeight: 500,
                    }}
                  >
                    {n.text}
                  </span>
                  <span
                    style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}
                  >
                    {n.time.toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="chat-window">
          <div className="chat-header">
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                className="mobile-only"
                onClick={() => setIsSidebarOpen(true)}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "4px",
                  cursor: "pointer",
                }}
              >
                <Menu size={24} color="var(--text-main)" />
              </button>
              <div
                className="avatar"
                style={{
                  width: "36px",
                  height: "36px",
                  background: "var(--primary)",
                }}
              >
                G
              </div>
              <div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                  Global chat Community
                </h3>
                <p style={{ fontSize: "0.75rem", color: "var(--success)" }}>
                  {users.filter((u) => u.online).length} online
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="icon-btn"
                onClick={() => setIsEditingProfile(true)}
                style={{
                  background: "transparent",
                  width: "auto",
                  padding: "8px",
                  cursor: "pointer",
                }}
                title="Edit Profile"
              >
                <Settings size={20} color="var(--text-muted)" />
              </button>
              <button
                className="icon-btn"
                onClick={() => {
                  if (
                    window.confirm(
                      "Are you sure you want to clear this chat locally?",
                    )
                  ) {
                    setClearedAt(new Date());
                    setLocalMessages([]);
                  }
                }}
                style={{
                  background: "transparent",
                  width: "auto",
                  padding: "8px",
                  cursor: "pointer",
                }}
                title="Clear Chat"
              >
                <Trash2 size={20} color="var(--warning)" />
              </button>
              <button
                className="icon-btn"
                onClick={onLogout}
                style={{
                  background: "transparent",
                  width: "auto",
                  padding: "8px",
                  cursor: "pointer",
                }}
                title="Logout"
              >
                <LogOut size={20} color="var(--text-muted)" />
              </button>
            </div>
          </div>

          <div className="messages-container">
            {historyLoading ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div className="typing-indicator">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <span>Loading history</span>
                </div>
              </div>
            ) : (
              filteredMessages.map((msg, i) => (
                <div
                  key={msg._id || i}
                  className={`message ${msg.sender?._id === user._id ? "sent" : "received"}`}
                >
                  {msg.sender?._id !== user._id && (
                    <span className="message-sender">
                      {msg.sender?.username}
                    </span>
                  )}
                  <div className="message-text">{msg.text}</div>
                  <span className="message-timestamp">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              ))
            )}

            {typingUsers.length > 0 &&
              typingUsers.map((u) => (
                <div key={u.userId} className="typing-indicator">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <span>{u.username} is typing...</span>
                </div>
              ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            {showEmojis && (
              <div
                className="emoji-picker glass-container"
                style={{
                  position: "absolute",
                  bottom: "100px",
                  padding: "12px",
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: "8px",
                  marginBottom: "12px",
                }}
              >
                {emojis.map((e) => (
                  <span
                    key={e}
                    onClick={() => addEmoji(e)}
                    style={{
                      cursor: "pointer",
                      fontSize: "1.2rem",
                      padding: "4px",
                      textAlign: "center",
                    }}
                  >
                    {e}
                  </span>
                ))}
              </div>
            )}
            <form onSubmit={handleSend} className="input-wrapper">
              <div
                style={{
                  position: "relative",
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowEmojis(!showEmojis)}
                  style={{
                    position: "absolute",
                    left: "12px",
                    background: "transparent",
                    width: "auto",
                    padding: 0,
                  }}
                >
                  <Smile size={20} color="var(--text-muted)" />
                </button>
                <input
                  type="text"
                  value={message}
                  onChange={handleInputChange}
                  placeholder="Type a message..."
                  style={{ paddingLeft: "44px" }}
                />
              </div>
              <button type="submit" disabled={!message.trim()}>
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatRoom;
