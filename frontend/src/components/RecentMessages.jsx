import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useDispatch, useSelector } from "react-redux";
import api from "../api/axios";
import toast from "react-hot-toast";
import { resetChatUnread } from "../features/messagesWS/chatCountSlice";
import { useSocket } from "../hooks/useSocket";

const RecentMessages = () => {
  const [chats, setChats] = useState([]);

  const { user } = useUser();
  const { getToken } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const socket = useSocket();

  const { perChat } = useSelector((state) => state.chatCount);
  const { connections = [] } = useSelector((state) => state.connections);

  /* ---------------- Fetch Initial 5 Chats ---------------- */

  const fetchRecentMessages = async () => {
    try {
      const token = await getToken();

      const { data } = await api.get("/api/chat/recent-messages", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        setChats(data.data);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchRecentMessages();

    const interval = setInterval(() => {
      fetchRecentMessages();
    }, 20000);

    return () => clearInterval(interval);
  }, [user]);

  /* ---------------- Realtime Socket Update ---------------- */

  useEffect(() => {
    if (!socket || !user?.id) return;

    const handleInboxMessage = (message) => {
      
      setChats((prev) => {
        const index = prev.findIndex((c) => c._id === message.chatId);

        // 🔹 If chat exists → update and move to top
        if (index !== -1) {
          const updatedChat = {
            ...prev[index],
            lastMessage: message,
            updatedAt: message.createdAt,
          };

          const newChats = [...prev];
          newChats.splice(index, 1);

          return [updatedChat, ...newChats].slice(0, 5);
        }

        // 🔹 If new chat → create minimal chat object
        const sender =
          connections.find((u) => u._id === message.senderId) ||
          connections.find((u) => u.clerkId === message.senderId);

        const newChat = {
          _id: message.chatId,
          otherUser: sender || {
            _id: message.senderId,
            full_name: "New User",
            profile_picture: "/default-avatar.png",
          },
          lastMessage: message,
          updatedAt: message.createdAt,
        };

        return [newChat, ...prev].slice(0, 5);
      });
    };

    socket.on("inbox_message", handleInboxMessage);

    return () => {
      socket.off("inbox_message", handleInboxMessage);
    };
  }, [socket, user?.id, connections]);

  /* ---------------- UI ---------------- */

  return (
    <div className="bg-white max-w-xs mt-4 p-4 min-h-20 rounded-md shadow text-xs text-slate-800">
      <h3 className="font-semibold mb-4">Recent Messages</h3>

      <div className="flex flex-col max-h-56 overflow-y-auto no-scrollbar">
        {chats.map((chat) => {
          const unreadCount = perChat[chat._id] || 0;

          return (
            <div
              key={chat._id}
              onClick={() => {
                dispatch(resetChatUnread(chat._id));
                navigate(`/messages/${chat._id}`);
              }} 
              className={`flex items-start gap-2 py-2 rounded-md px-2 transition cursor-pointer ${ unreadCount > 0 ? "bg-indigo-50 border-l-4 border-indigo-500" : "hover:bg-slate-100" }`} 
              >
              <img
                src={chat.otherUser?.profile_picture}
                alt="profile"
                className="w-8 h-8 rounded-full object-cover"
              />

              <div className="w-full">
                <div className="flex items-center justify-between">
                  <p
                    className={`font-medium ${
                      unreadCount ? "text-indigo-700" : ""
                    }`}
                  >
                    {chat.otherUser?.full_name}
                  </p>

                  <p className="text-[10px] text-slate-400">
                    {moment(chat.updatedAt).fromNow()}
                  </p>
                </div>

                <div className="flex justify-between items-center">
                  <p
                    className={`truncate max-w-[120px] ${
                      unreadCount
                        ? "font-semibold text-slate-800"
                        : "text-gray-500"
                    }`}
                  >
                    {chat.lastMessage?.text
                      ? chat.lastMessage.text
                      : chat.lastMessage?.media
                        ? "Media"
                        : ""}
                  </p>

                  {unreadCount > 0 && (
                    <span className="bg-indigo-500 text-white min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] px-1">
                      {unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {chats.length === 0 && (
          <p className="text-gray-400 text-center py-4">No recent messages</p>
        )}

      </div>
    </div>
  );
};

export default RecentMessages;
