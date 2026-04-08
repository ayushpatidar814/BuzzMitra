import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Search, MoreVertical, Users, Plus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { resetChatUnread, setInitialCounts } from "../../features/messagesWS/chatCountSlice";
import { useSocket } from "../../hooks/useSocket";
import api from "../../api/axios";
import toast from "react-hot-toast";
import Loading from "../../components/Loading";
import { useAuth } from "../../auth/AuthProvider";
import Avatar from "../../components/Avatar";

const MessageWS = () => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [menuChatId, setMenuChatId] = useState(null);
  const [clearingChatId, setClearingChatId] = useState(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const navigate = useNavigate();
  const { authHeaders } = useAuth();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.value);
  const socket = useSocket();
  const { network = [] } = useSelector((state) => state.connections);
  const { perChat } = useSelector((state) => state.chatCount );

  const fetchChats = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/chat/chats", { headers: authHeaders });
      if (data.success) {
        setChats(data.data);
        dispatch(setInitialCounts(data.data));
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, dispatch]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    if (!socket || !user?._id) return;
    const handleInboxMessage = (message) => {
      setChats((prev) => {
        const index = prev.findIndex((chat) => chat._id === message.chatId);
        if (index !== -1) {
          const updatedChat = { ...prev[index], lastMessage: message, updatedAt: message.createdAt };
          const next = [...prev];
          next.splice(index, 1);
          return [updatedChat, ...next];
        }
        const sender = network.find((item) => String(item._id) === String(message.senderId));
        return [{
          _id: message.chatId,
          isGroup: message.receiverId === null,
          title: message.receiverId === null ? "Group chat" : undefined,
          avatar: "",
          otherUser: sender || { _id: message.senderId, full_name: "New User", username: "", profile_picture: "https://placehold.co/80x80" },
          lastMessage: message,
          updatedAt: message.createdAt,
        }, ...prev];
      });
    };

    socket.on("inbox_message", handleInboxMessage);
    return () => socket.off("inbox_message", handleInboxMessage);
  }, [socket, user?._id, network]);

  const clearChatForMe = async (chatId) => {
    try {
      setClearingChatId(chatId);
      await api.delete(`/api/chat/${chatId}/clear`, { headers: authHeaders });
      setChats((prev) => prev.filter((chat) => chat._id !== chatId));
      dispatch(resetChatUnread(chatId));
      toast.success("Chat cleared");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setMenuChatId(null);
      setClearingChatId(null);
    }
  };

  const startChat = async (receiverId) => {
    try {
      const { data } = await api.post("/api/chat/chat", { receiverId }, { headers: authHeaders });
      if (data.success) navigate(`/app/messages/${data.data._id}`);
      else toast.error(data.message);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const filteredChats = useMemo(() => {
    if (!search.trim()) return chats;
    return chats.filter((chat) => {
      const person = chat.otherUser;
      return chat.title?.toLowerCase().includes(search.toLowerCase()) || person?.full_name?.toLowerCase().includes(search.toLowerCase()) || person?.username?.toLowerCase().includes(search.toLowerCase());
    });
  }, [search, chats]);

  const filteredNetwork = useMemo(() => {
    if (!search.trim()) return network;
    return network.filter((person) => person.full_name?.toLowerCase().includes(search.toLowerCase()) || person.username?.toLowerCase().includes(search.toLowerCase()));
  }, [search, network]);

  const createGroup = async () => {
    if (!groupName.trim()) return toast.error("Enter a group name");
    if (selectedMembers.length < 2) return toast.error("Pick at least two people");

    try {
      setCreatingGroup(true);
      const { data } = await api.post("/api/chat/group", {
        name: groupName,
        participantIds: selectedMembers,
      }, { headers: authHeaders });

      if (!data.success) throw new Error(data.message);
      setGroupModalOpen(false);
      setGroupName("");
      setSelectedMembers([]);
      toast.success("Group created");
      navigate(`/app/messages/${data.data._id}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCreatingGroup(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="px-4 pb-12 pt-8 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Messages</h1>
              <p className="mt-2 text-slate-500">Private chats and groups that stay in sync.</p>
            </div>
            <button onClick={() => setGroupModalOpen(true)} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" />
              New group
            </button>
          </div>

          <div className="mt-6 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <Search className="w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats or people" className="flex-1 bg-transparent outline-none" />
          </div>

          <div className="mt-6 space-y-3">
            {filteredChats.map((chat) => {
              const otherUser = chat.otherUser;
              const unreadCount = perChat[chat._id] || 0;
              return (
                <div key={chat._id} onClick={() => { dispatch(resetChatUnread(chat._id)); navigate(`/app/messages/${chat._id}`); }} className={`relative flex gap-4 rounded-[1.5rem] border border-slate-100 p-4 ${unreadCount > 0 ? "bg-lime-50" : "bg-slate-50"} cursor-pointer`}>
                  <div className="relative">
                    <Avatar src={chat.isGroup ? chat.avatar : otherUser?.profile_picture} size="sm" alt={chat.isGroup ? chat.title : (otherUser?.full_name || "User")} />
                    {chat.isGroup && <span className="absolute -bottom-1 -right-1 rounded-full bg-slate-950 p-1 text-white"><Users className="h-3 w-3" /></span>}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{chat.isGroup ? chat.title : (otherUser?.full_name || "User Name")}</p>
                    <p className="text-sm text-slate-500 truncate">{chat.lastMessage?.text || (chat.lastMessage?.media ? "Media" : "Start a conversation")}</p>
                  </div>
                  {unreadCount > 0 && <span className="absolute right-14 top-6 rounded-full bg-slate-950 px-2 py-1 text-xs font-bold text-white">{unreadCount}</span>}
                  <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setMenuChatId(menuChatId === chat._id ? null : chat._id); }} className="rounded-full p-1 hover:bg-slate-200">
                      <MoreVertical className="w-5 h-5 text-slate-500" />
                    </button>
                    {menuChatId === chat._id && (
                      <div className="absolute right-0 top-8 z-50 w-40 rounded-2xl border border-slate-200 bg-white shadow-xl">
                        <button disabled={clearingChatId === chat._id} onClick={(e) => { e.stopPropagation(); clearChatForMe(chat._id); }} className="w-full px-4 py-3 text-left text-sm text-red-600">
                          {clearingChatId === chat._id ? "Clearing..." : "Delete chat"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {search && filteredChats.length === 0 && (
              <div>
                <p className="mb-3 text-sm text-slate-500">Start new chat</p>
                {filteredNetwork.map((person) => (
                  <div key={person._id} onClick={() => startChat(person._id)} className="flex gap-4 rounded-[1.5rem] bg-slate-50 p-4 cursor-pointer">
                    <Avatar src={person?.profile_picture} size="sm" alt={person?.full_name || "User"} />
                    <div className="flex-1">
                      <p className="font-medium">{person?.full_name}</p>
                      <p className="text-sm text-slate-500">@{person?.username}</p>
                    </div>
                    <MessageSquare className="w-5 h-5 text-slate-400" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {groupModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/50 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-10 max-w-xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-400">New Group</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Create a group chat</h2>
              </div>
              <button onClick={() => setGroupModalOpen(false)} className="rounded-full bg-slate-100 px-3 py-1 text-sm">Close</button>
            </div>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              className="mt-5 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
            />
            <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
              {network.map((person) => {
                const checked = selectedMembers.includes(person._id);
                return (
                  <label key={person._id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 ${checked ? "border-slate-950 bg-slate-50" : "border-slate-200"}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setSelectedMembers((prev) => checked ? prev.filter((id) => id !== person._id) : [...prev, person._id])}
                    />
                    <Avatar src={person.profile_picture} size="sm" alt={person.full_name} />
                    <div>
                      <p className="font-medium text-slate-900">{person.full_name}</p>
                      <p className="text-sm text-slate-500">@{person.username}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            <button disabled={creatingGroup} onClick={createGroup} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {creatingGroup ? "Creating group..." : "Create group"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageWS;
