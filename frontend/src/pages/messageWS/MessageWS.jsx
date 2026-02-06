import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Search } from "lucide-react";
import { useAuth } from "@clerk/clerk-react";

import api from "../../api/axios";
import toast from "react-hot-toast";
import Loading from "../../components/Loading";
import { useSocket } from "../../hooks/useSocket.js";

const MessageWS = () => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const navigate = useNavigate();
  const { getToken } = useAuth();

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
        console.log(data.data)
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


  const startChat = async (chatId) => {
      navigate(`/messages/${chatId}`);
  }

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
                onClick={() => navigate(`/messages/${chat._id}`)}
                className="flex gap-4 p-4 bg-white rounded-md shadow cursor-pointer hover:bg-slate-100"
              >
                <img
                  src={otherUser?.profile_picture || "/default-avatar.png"}
                  className="size-12 rounded-full"
                  alt={otherUser?.full_name || "User"}
                />

                <div className="flex-1">
                  <p className="font-medium">{otherUser?.full_name || "User Name"}</p>
                  <p className="text-sm text-slate-500 truncate">
                    {chat.lastMessage?.text || "Start a conversation"}
                  </p>
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
