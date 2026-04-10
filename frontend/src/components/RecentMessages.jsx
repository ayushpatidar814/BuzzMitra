import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import { useDispatch, useSelector } from "react-redux";
import api from "../api/axios";
import toast from "react-hot-toast";
import { resetChatUnread } from "../features/messagesWS/chatCountSlice";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../auth/AuthProvider";
import Avatar from "./Avatar";
import { useThemeSettings } from "../theme/ThemeProvider";
import clsx from "clsx";

const RecentMessages = ({ initialChats = null, suspendInitialFetch = false }) => {
  const [chats, setChats] = useState(initialChats || []);
  const { authHeaders } = useAuth();
  const user = useSelector((state) => state.user.value);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const socket = useSocket();
  const { perChat } = useSelector((state) => state.chatCount);
  const { network = [] } = useSelector((state) => state.connections);
  const bootstrappedRef = useRef(Boolean(initialChats));
  const { theme } = useThemeSettings();
  const isLight = theme === "light";
  const isDark = theme === "dark";

  const fetchRecentMessages = useCallback(async () => {
    try {
      const { data } = await api.get("/api/chat/recent-messages", { headers: authHeaders });
      if (data.success) setChats(data.data);
      else toast.error(data.message);
    } catch (error) {
      toast.error(error.message);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (initialChats) {
      setChats(initialChats);
      bootstrappedRef.current = true;
    }
  }, [initialChats]);

  useEffect(() => {
    if (suspendInitialFetch) return;
    if (!user?._id) return;
    if (bootstrappedRef.current) {
      bootstrappedRef.current = false;
    } else {
      fetchRecentMessages();
    }
    const interval = setInterval(fetchRecentMessages, 20000);
    return () => clearInterval(interval);
  }, [user?._id, fetchRecentMessages, suspendInitialFetch]);

  useEffect(() => {
    if (!socket || !user?._id) return;
    const handleInboxMessage = (message) => {
      setChats((prev) => {
        const index = prev.findIndex((chat) => chat._id === message.chatId);
        if (index !== -1) {
          const updated = { ...prev[index], lastMessage: message, updatedAt: message.createdAt };
          const next = [...prev];
          next.splice(index, 1);
          return [updated, ...next].slice(0, 5);
        }
        const isGroup = Boolean(message.receiverId === null);
        const sender = network.find((item) => String(item._id) === String(message.senderId));
        return [{
          _id: message.chatId,
          isGroup,
          title: isGroup ? "Group chat" : (sender?.full_name || "New User"),
          avatar: isGroup ? "" : (sender?.profile_picture || "https://placehold.co/80x80"),
          otherUser: sender || { _id: message.senderId, full_name: "New User", profile_picture: "https://placehold.co/80x80" },
          lastMessage: message,
          updatedAt: message.createdAt,
        }, ...prev].slice(0, 5);
      });
    };

    socket.on("inbox_message", handleInboxMessage);
    return () => socket.off("inbox_message", handleInboxMessage);
  }, [socket, user?._id, network]);

  return (
    <div className={clsx("rounded-[2rem] border p-5 shadow-xl", isLight ? "border-slate-200 bg-white shadow-slate-200/30" : isDark ? "border-white/10 bg-black/80 text-white shadow-black/30" : "border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/30")}>
      <h3 className={clsx("font-semibold", isLight ? "text-slate-900" : isDark ? "text-white" : "text-slate-900")}>Inbox</h3>
      <div className="mt-4 flex flex-col max-h-80 overflow-y-auto no-scrollbar">
        {chats.map((chat) => {
          const unreadCount = perChat[chat._id] || 0;
          return (
            <div
              key={chat._id}
              onClick={() => {
                dispatch(resetChatUnread(chat._id));
                navigate(`/app/messages/${chat._id}`);
              }}
              className={clsx("flex items-start gap-3 rounded-2xl px-3 py-3 transition cursor-pointer", unreadCount > 0
                ? (isDark ? "bg-white/8" : "bg-lime-50")
                : (isLight ? "hover:bg-slate-50" : isDark ? "hover:bg-white/6" : "hover:bg-slate-50"))}
            >
              <Avatar
                src={chat.isGroup ? chat.avatar : chat.otherUser?.profile_picture}
                alt={chat.isGroup ? (chat.title || "Group chat") : "profile"}
                size="xs"
              />
              <div className="w-full">
                <div className="flex items-center justify-between">
                  <p className={clsx("font-medium", unreadCount ? (isDark ? "text-white" : "text-slate-950") : (isDark ? "text-white/84" : "text-slate-700"))}>{chat.isGroup ? chat.title : chat.otherUser?.full_name}</p>
                  <p className={clsx("text-[10px]", isDark ? "text-white/40" : "text-slate-400")}>{moment(chat.updatedAt).fromNow()}</p>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className={clsx("truncate text-sm", isDark ? "text-white/58" : "text-slate-500")}>{chat.lastMessage?.text || (chat.lastMessage?.media ? "Media" : "")}</p>
                  {unreadCount > 0 && <span className={clsx("min-w-[18px] rounded-full px-2 py-1 text-[10px] font-semibold", isDark ? "bg-white text-black" : "bg-slate-950 text-white")}>{unreadCount}</span>}
                </div>
              </div>
            </div>
          );
        })}

        {chats.length === 0 && <p className={clsx("py-4 text-center text-sm", isDark ? "text-white/45" : "text-slate-400")}>Your recent conversations will show up here.</p>}
      </div>
    </div>
  );
};

export default RecentMessages;
