import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Search, MoreVertical } from "lucide-react";
import { useAuth, useUser } from "@clerk/clerk-react";

import api from "../../api/axios";
import toast from "react-hot-toast";
import Loading from "../../components/Loading";
import { useSocket } from "../../hooks/useSocket.js";

const MessageWS = () => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [menuChatId, setMenuChatId] = useState(null);
  const [clearingChatId, setClearingChatId] = useState(null);

  const navigate = useNavigate();
  const { getToken } = useAuth();
  
  const { user } = useUser();
  const socket = useSocket();

  const { connections = [] } = useSelector((state) => state.connections);

  /* ---------------- fetch chats ---------------- */

  const fetchChats = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/chat/chats", {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });

      if (data.success) {
        setChats(data.data);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  /* ---------------- socket: join user ---------------- */

  useEffect(() => {
    if (!socket || !user?.id) return;
    socket.emit("join_user", user.id);
  }, [socket, user?.id]);


  /* ---------------- socket: inbox messages ---------------- */
  useEffect(() => {
    if (!socket || !user?.id) return;

    const handleInboxMessage = (message) => {
      setChats((prev) => {
        const index = prev.findIndex((c) => c._id === message.chatId);
        const isIncoming = message.receiverId === user.id;

        // 🔹 Chat already exists
        if (index !== -1) {
          const updatedChat = {
            ...prev[index],
            lastMessage: message,
            unreadMessages: isIncoming ? (prev[index].unreadMessages || 0) + 1 : prev[index].unreadMessages,
            updatedAt: message.createdAt,
          };

          const newChats = [...prev];
          newChats.splice(index, 1);

          return [updatedChat, ...newChats];
        }

        // 🔹 New chat
        const sender =
          connections.find(u => u._id === message.senderId) ||
          connections.find(u => u.clerkId === message.senderId);

        return [
          {
            _id: message.chatId,
            otherUser: sender || {
              _id: message.senderId,
              full_name: "New User",
              username: "",
              profile_picture: "/default-avatar.png",
            },
            lastMessage: message,
            unreadMessages: 1,
            updatedAt: message.createdAt,
          },
          ...prev,
        ];

      });
    };

    socket.on("inbox_message", handleInboxMessage);

    return () => {
      socket.off("inbox_message", handleInboxMessage);
    };
  }, [socket, user?.id, connections]);


  /* ---------------- socket: message status ---------------- */
  useEffect(() => {
    if (!socket) return;

    const updateStatus = ({ messageId, status }) => {
      setChats(prev =>
        prev.map(chat =>
          chat.lastMessage?.messageId === messageId && chat.lastMessage.status !== "read"
            ? {
                ...chat,
                lastMessage: {
                  ...chat.lastMessage,
                  status,
                },
              }
            : chat
        )
      );
    };

    socket.on("message_delivered", ({ messageId }) =>
      updateStatus({ messageId, status: "delivered" })
    );

    socket.on("message_read", ({ messageId }) =>
      updateStatus({ messageId, status: "read" })
    );

    return () => {
      socket.off("message_delivered");
      socket.off("message_read");
    };
  }, [socket]);


  /* ---------------- socket: chat cleared (multi-tab) ---------------- */

  useEffect(() => {
    if (!socket || !user?.id) return;

    const onChatCleared = ({ chatId, userId }) => {
      if (userId !== user.id) return;

      setChats((prev) =>
        prev.map((c) =>
          c._id === chatId
            ? { ...c, lastMessage: null, unreadMessages: 0 }
            : c
        )
      );
    };

    socket.on("chat:cleared", onChatCleared);
    return () => socket.off("chat:cleared", onChatCleared);
  }, [socket, user?.id]);

  /* ---------------- clear chat ---------------- */

  const clearChatForMe = async (chatId) => {
    try {
      setClearingChatId(chatId);

      await api.delete(`/api/chat/${chatId}/clear`, {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });

      setChats((prev) => prev.filter((c) => c._id !== chatId));

      socket?.emit("chat:cleared", {
        chatId,
        userId: user.id,
      });

      toast.success("Chat cleared");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setMenuChatId(null);
      setClearingChatId(null);
    }
  };


  /* ---------------- start new chat ---------------- */

  const startChat = async (receiverId) => {
    try {
      const token = await getToken();
      const { data } = await api.post("/api/chat/chat", { receiverId }, { headers: { Authorization: `Bearer ${token}` },});

      if (data.success) {
        const chat = data.data;
        // Optimistically add to chats list if not already present
        setChats((prev) => {
          prev.some((c) => c._id === chat._id) ? prev : [chat, ...prev]
        });

        // Navigate to chat page
        navigate(`/messages/${chat._id}`);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };


  /* ---------------- helpers ---------------- */

  const filteredChats = useMemo(() => {
    if (!search.trim()) return chats;

    return chats.filter((chat) => {
      const u = chat.otherUser;
      return (
        u?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u?.username?.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [search, chats]);

  const filteredConnections = useMemo(() => {
    if (!search.trim()) return [];

    return connections.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.username?.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, connections]);


  /* ---------------- UI ---------------- */

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <h1 className="text-3xl font-bold mb-2">Messages</h1>
        <p className="text-slate-600 mb-6">Your conversations</p>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white p-3 rounded-md shadow mb-6">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people"
            className="flex-1 outline-none"
          />
        </div>

        {/* Chats */}
        <div className="space-y-3">
          {filteredChats.map((chat) => {
            const otherUser = chat.otherUser;

            return (
              <div
                key={chat._id}
                onClick={() => {
                  setChats(prev =>
                    prev.map(c =>
                      c._id === chat._id
                        ? { ...c, unreadMessages: 0 }
                        : c
                    )
                  );
                  navigate(`/messages/${chat._id}`)
                }}
                className={`relative flex gap-4 p-4 ${chat.unreadMessages > 0 ? "bg-slate-50" : "bg-white"} rounded-md shadow cursor-pointer hover:bg-slate-100`}
              >
                <img
                  src={otherUser?.profile_picture || "/default-avatar.png"}
                  className="size-12 rounded-full"
                  alt={otherUser?.full_name || "User"}
                />

                <div className="flex-1">
                  <p className={`${chat.unreadMessages > 0 ? "font-semibold text-gray-900" : "font-medium text-gray-800"}`}>{otherUser?.full_name || "User Name"}</p>
                  <p className="text-sm text-slate-500 truncate">
                    {chat.lastMessage?.text ? chat.lastMessage?.text : chat.lastMessage?.media ? "Media" : "Start a conversation"}
                  </p>
                </div>
                {/* 🔹 Unread badge */}
                {chat.lastMessage?.status !== "read" && chat.unreadMessages > 0 && (
                  <span className="absolute top-7 right-12 bg-gray-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {chat.unreadMessages}
                  </span>
                )}

                {/* Menu */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuChatId(
                        menuChatId === chat._id ? null : chat._id
                      );
                    }}
                    className="p-1 rounded hover:bg-slate-200"
                  >
                    <MoreVertical className="w-5 h-5 text-slate-500" />
                  </button>

                  {menuChatId === chat._id && (
                    <div className="absolute right-0 top-7 bg-white border rounded-md shadow z-50 w-40">
                      <button
                        disabled={clearingChatId === chat._id}
                        onClick={(e) => {
                          e.stopPropagation();
                          clearChatForMe(chat._id);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-100 rounded-md"
                      >
                        {clearingChatId === chat._id
                          ? "Clearing..."
                          : "Delete chat"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Start new chat */}
          {search && filteredChats.length === 0 && (
            <div>
              <p className="text-sm text-slate-500 mb-2">Start new chat</p>

              {filteredConnections.map((user) => (
                <div
                  key={user._id}
                  onClick={() => startChat(user._id)}
                  className="flex gap-4 p-4 bg-white rounded-md shadow cursor-pointer hover:bg-slate-100"
                >
                  <img
                    src={user?.profile_picture || "/default-avatar.png"}
                    className="size-12 rounded-full"
                    alt={user?.full_name || "User"}
                  />

                  <div className="flex-1">
                    <p className="font-medium">{user?.full_name}</p>
                    <p className="text-sm text-slate-500">@{user?.username}</p>
                  </div>

                  <MessageSquare className="w-5 h-5 text-slate-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageWS;
