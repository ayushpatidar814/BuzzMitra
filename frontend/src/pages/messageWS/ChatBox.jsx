import React, { useEffect, useMemo, useRef, useState } from "react";
import { Eye, ImageIcon, MoreVertical, SendHorizonal, Users } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios.js";
import Loading from "../../components/Loading.jsx";
import formatTime from "../../utils/formatTime.js";
import { useSocket } from "../../hooks/useSocket.js";
import { useDispatch, useSelector } from "react-redux";
import { resetChatUnread } from "../../features/messagesWS/chatCountSlice.js";
import toast from "react-hot-toast";
import { useAuth } from "../../auth/AuthProvider.jsx";
import chatBg from "../../assets/chatbox_background.png";
import Avatar from "../../components/Avatar.jsx";

const mergeMessages = (previous = [], incoming = []) => {
  const map = new Map();
  [...previous, ...incoming].forEach((message) => {
    const key = String(message.messageId || `${message._id}-${message.createdAt}`);
    const existing = map.get(key);
    map.set(key, existing ? { ...existing, ...message } : message);
  });
  return Array.from(map.values()).sort((left, right) => {
    const timeGap = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    if (timeGap !== 0) return timeGap;
    return String(left.messageId || left._id).localeCompare(String(right.messageId || right._id));
  });
};

const ChatBox = () => {
  const { chatId } = useParams();
  const { authHeaders } = useAuth();
  const loggedInUser = useSelector((state) => state.user.value);
  const myUserId = loggedInUser?._id;
  const [user, setUser] = useState(null);
  const [chatMeta, setChatMeta] = useState(null);
  const [chats, setChats] = useState([]);
  const [messagesCursor, setMessagesCursor] = useState(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [disabled, setDisabled] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [viewerModal, setViewerModal] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupActionLoading, setGroupActionLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupAvatarFile, setGroupAvatarFile] = useState(null);
  const [memberMenuId, setMemberMenuId] = useState(null);
  const socket = useSocket();
  const dispatch = useDispatch();
  const joinedChatsRef = useRef(new Set());
  const navigate = useNavigate();
  const network = useSelector((state) => state.connections.network || []);
  const isGroupAdmin = useMemo(() => Boolean(chatMeta?.groupAdminIds?.includes(String(myUserId))), [chatMeta?.groupAdminIds, myUserId]);
  const isGroupOwner = useMemo(() => String(chatMeta?.groupOwnerId || "") === String(myUserId), [chatMeta?.groupOwnerId, myUserId]);
  const availableMembers = useMemo(() => network.filter((person) => !chatMeta?.participants?.some((participant) => String(participant._id) === String(person._id))), [network, chatMeta?.participants]);

  useEffect(() => {
    if (!chatId) return;

    const fetchMessages = async () => {
      try {
        const { data } = await api.getDedup(`/api/chat/messages/${chatId}`, { headers: authHeaders });
        if (data.success) {
          setChats(mergeMessages([], data.data.messages || []));
          setUser(data.data.receiver || null);
          setChatMeta(data.data.chat || null);
          setHasMoreMessages(Boolean(data.data.hasMore));
          setMessagesCursor(data.data.nextCursor || null);
          setGroupName(data.data.chat?.groupName || "");
          setGroupAvatarFile(null);
          dispatch(resetChatUnread(chatId));
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchMessages();
  }, [chatId, authHeaders, dispatch]);

  const loadOlderMessages = async () => {
    if (!chatId || !messagesCursor || loadingOlderMessages) return;
    try {
      setLoadingOlderMessages(true);
      const { data } = await api.get(`/api/chat/messages/${chatId}`, {
        headers: authHeaders,
        params: { cursor: messagesCursor, limit: 40 },
      });
      if (!data.success) throw new Error(data.message);
      setChats((prev) => mergeMessages(prev, data.data.messages || []));
      setHasMoreMessages(Boolean(data.data.hasMore));
      setMessagesCursor(data.data.nextCursor || null);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  useEffect(() => {
    if (!chatId || !socket) return;
    if (joinedChatsRef.current.has(chatId)) return;

    socket.emit("join_chat", chatId);
    joinedChatsRef.current.add(chatId);

    const handleNewMessage = (message) => {
      if (String(message.chatId) !== String(chatId)) return;
      setChats((prev) => mergeMessages(prev, [message]));
    };

    const handleNewMessageBatch = (messages = []) => {
      setChats((prev) => mergeMessages(prev, messages));
    };

    const handleTyping = ({ chatId: nextChatId, userId, isTyping }) => {
      if (String(nextChatId) !== String(chatId)) return;
      setTypingUsers((prev) => ({ ...prev, [userId]: isTyping }));
    };

    const handleDeleted = ({ messageId }) => {
      setChats((prev) => prev.filter((message) => message.messageId !== messageId));
    };

    const handleEdited = ({ messageId, text: nextText }) => {
      setChats((prev) => prev.map((message) => (message.messageId === messageId ? { ...message, text: nextText, edited: true } : message)));
    };

    const applyStatus = ({ messageId, deliveredTo, readBy, status }) => {
      setChats((prev) =>
        prev.map((message) =>
          message.messageId === messageId
            ? {
                ...message,
                deliveredTo: deliveredTo || message.deliveredTo || [],
                readBy: readBy || message.readBy || [],
                status: status || message.status,
              }
            : message
        )
      );
    };

    socket.on("new_message", handleNewMessage);
    socket.on("new_message_batch", handleNewMessageBatch);
    socket.on("typing", handleTyping);
    socket.on("message_deleted", handleDeleted);
    socket.on("message_edited", handleEdited);
    socket.on("message_delivered", applyStatus);
    socket.on("message_read", applyStatus);
    socket.on("message_status", applyStatus);
    socket.on("message_delivered_batch", (items = []) => items.forEach(applyStatus));
    socket.on("message_read_batch", (items = []) => items.forEach(applyStatus));
    socket.on("message_status_batch", (items = []) => items.forEach(applyStatus));

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("new_message_batch", handleNewMessageBatch);
      socket.off("typing", handleTyping);
      socket.off("message_deleted", handleDeleted);
      socket.off("message_edited", handleEdited);
      socket.off("message_delivered", applyStatus);
      socket.off("message_read", applyStatus);
      socket.off("message_status", applyStatus);
      socket.off("message_delivered_batch");
      socket.off("message_read_batch");
      socket.off("message_status_batch");
    };
  }, [chatId, socket]);

  useEffect(() => {
    if (!chatId || !socket || chats.length === 0) return;
    dispatch(resetChatUnread(chatId));
    socket.emit("read_messages", { chatId });
  }, [chatId, socket, chats.length, dispatch]);

  useEffect(() => {
    if (!socket || !myUserId) return;
    socket.emit("join_user", myUserId);
  }, [socket, myUserId]);

  useEffect(() => {
    document.getElementById("chat-end")?.scrollIntoView({ behavior: "smooth" });
  }, [chats.length]);

  const sendMessage = async () => {
    if ((!text.trim() && !image && !editText.trim()) || !chatId || (!user?._id && !chatMeta?.isGroup)) return;

    if (editingId) {
      setChats((prev) => prev.map((message) => (message.messageId === editingId ? { ...message, text: editText, edited: true } : message)));
      socket.emit("edit_message", { chatId, messageId: editingId, text: editText });
      setEditingId(null);
      setEditText("");
      return;
    }

    const messageId = crypto.randomUUID();
    setDisabled(true);
    let uploadedMedia = null;

    try {
      if (image) {
        const formData = new FormData();
        formData.append("media", image);
        const res = await api.post("/api/chat/uploadMedia", formData, {
          headers: { ...authHeaders, "Content-Type": "multipart/form-data" },
        });
        uploadedMedia = res.data.media;
      }

      if (!socket.connected) {
        throw new Error("Realtime connection is unavailable. Please wait a moment and try again.");
      }

      const payload = {
        chatId,
        receiverId: chatMeta?.isGroup ? null : user?._id,
        messageId,
        text: text.trim(),
        type: uploadedMedia ? "media" : "text",
        media: uploadedMedia || null,
      };

      setChats((prev) => mergeMessages(prev, [{
        ...payload,
        senderId: myUserId,
        status: "sent",
        deliveredTo: [myUserId],
        readBy: [myUserId],
        createdAt: new Date().toISOString(),
      }]));
      socket.emit("send_message", payload);
      setText("");
      setImage(null);
      setPreview(null);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDisabled(false);
    }
  };

  const openMessageViewers = async (messageId) => {
    if (!chatMeta?.isGroup) return;

    try {
      setViewerLoading(true);
      const { data } = await api.get(`/api/chat/message-viewers/${messageId}`, { headers: authHeaders });
      if (!data.success) throw new Error(data.message);
      setViewerModal(data.viewers || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setViewerLoading(false);
    }
  };

  const renameGroup = async () => {
    if (!chatMeta?.isGroup || !groupName.trim()) return;
    try {
      setGroupActionLoading(true);
      const { data } = await api.post(`/api/chat/group/${chatId}/rename`, { name: groupName }, { headers: authHeaders });
      if (!data.success) throw new Error(data.message);
      setChatMeta((prev) => ({ ...prev, groupName: data.chat.groupName }));
      toast.success("Group name updated");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setGroupActionLoading(false);
    }
  };

  const addMembers = async () => {
    if (!selectedMembers.length) return;
    try {
      setGroupActionLoading(true);
      const { data } = await api.post(`/api/chat/group/${chatId}/members`, { participantIds: selectedMembers }, { headers: authHeaders });
      if (!data.success) throw new Error(data.message);
      applyChatUpdate(data.chat);
      setSelectedMembers([]);
      toast.success("Members added");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setGroupActionLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    try {
      setGroupActionLoading(true);
      const { data } = await api.post(`/api/chat/group/${chatId}/leave`, {}, { headers: authHeaders });
      if (!data.success) throw new Error(data.message);
      toast.success(data.message);
      navigate("/app/messages");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setGroupActionLoading(false);
    }
  };

  const updateGroupAvatar = async (file) => {
    if (!file) return;
    try {
      setGroupActionLoading(true);
      const formData = new FormData();
      formData.append("avatar", file);
      const { data } = await api.post(`/api/chat/group/${chatId}/avatar`, formData, {
        headers: { ...authHeaders, "Content-Type": "multipart/form-data" },
      });
      if (!data.success) throw new Error(data.message);
      setChatMeta((prev) => ({ ...prev, groupAvatar: data.chat.groupAvatar }));
      setGroupAvatarFile(null);
      toast.success("Group photo updated");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setGroupActionLoading(false);
    }
  };

  const applyChatUpdate = (chat) => {
    const nextIds = (chat.participants || []).map((id) => String(id));
    const knownMembers = [...(chatMeta?.participants || []), ...network];
    setChatMeta((prev) => ({
      ...prev,
      groupName: chat.groupName || prev.groupName,
      groupAvatar: chat.groupAvatar || prev.groupAvatar,
      groupAdminIds: (chat.groupAdminIds || []).map((id) => String(id)),
      groupOwnerId: chat.groupOwnerId ? String(chat.groupOwnerId) : prev.groupOwnerId,
      participants: knownMembers.filter((member, index, arr) => nextIds.includes(String(member._id)) && arr.findIndex((item) => String(item._id) === String(member._id)) === index),
    }));
  };

  const updateMemberRole = async (memberId, action) => {
    try {
      setGroupActionLoading(true);
      const { data } = await api.post(`/api/chat/group/${chatId}/members/${memberId}/${action}`, {}, { headers: authHeaders });
      if (!data.success) throw new Error(data.message);
      applyChatUpdate(data.chat);
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setGroupActionLoading(false);
    }
  };

  const removeMember = async (memberId) => {
    try {
      setGroupActionLoading(true);
      const { data } = await api.post(`/api/chat/group/${chatId}/members/${memberId}/remove`, {}, { headers: authHeaders });
      if (!data.success) throw new Error(data.message);
      applyChatUpdate(data.chat);
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setGroupActionLoading(false);
    }
  };

  const getGroupStatusLabel = (message) => {
    const others = (chatMeta?.participants || []).filter((participant) => String(participant._id) !== String(myUserId));
    const readCount = (message.readBy || []).filter((id) => String(id) !== String(myUserId)).length;
    if (!others.length) return "Tap to view";
    return readCount > 0 ? `Seen by ${readCount}/${others.length}` : "Tap to view";
  };

  if (!chatMeta) return <Loading />;

  return (
    <div className="flex h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(190,242,100,.15),_transparent_20%),linear-gradient(180deg,_#f8fafc,_#eef2ff)]">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur md:px-10">
        <Avatar
          src={chatMeta.isGroup ? chatMeta.groupAvatar : user?.profile_picture}
          size="sm"
          alt={chatMeta.isGroup ? chatMeta.groupName : user?.full_name}
        />
        <div>
          <p className="font-semibold text-slate-900">{chatMeta.isGroup ? chatMeta.groupName : user?.full_name}</p>
          <p className="text-sm text-slate-500">
            {chatMeta.isGroup ? `${(chatMeta.participants || []).length} members` : `@${user?.username}`}
          </p>
        </div>
        {chatMeta.isGroup && (
          <button onClick={() => setGroupSheetOpen(true)} className="ml-auto inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700">
            <Users className="h-4 w-4 text-slate-400" />
            Group info
          </button>
        )}
      </div>

      <div className="h-full overflow-y-scroll p-5 md:px-10" style={{ backgroundImage: `url(${chatBg})` }}>
        <div className="mx-auto max-w-5xl space-y-4">
          {hasMoreMessages && (
            <div className="flex justify-center">
              <button
                onClick={loadOlderMessages}
                disabled={loadingOlderMessages}
                className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-700 shadow-sm backdrop-blur disabled:opacity-60"
              >
                {loadingOlderMessages ? "Loading older messages..." : "Load older messages"}
              </button>
            </div>
          )}
          {chats.map((message) => {
            const isSender = String(message.senderId) === String(myUserId);

            return (
              <div key={`${message.messageId}-${message.createdAt}`} className={`group flex ${isSender ? "justify-end" : "justify-start"}`}>
                <div className="relative max-w-md">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === message.messageId ? null : message.messageId);
                    }}
                    className={`absolute top-1 ${!isSender ? "left-0" : "right-0"} hidden text-gray-600 group-hover:block`}
                  >
                    <MoreVertical size={16} />
                  </button>

                  {openMenuId === message.messageId && (
                    <div className={`absolute z-10 mt-2 w-36 rounded-2xl border border-slate-200 bg-white text-sm shadow-md ${!isSender ? "left-4" : "right-4"}`}>
                      {isSender ? (
                        <>
                          <button onClick={() => { setEditingId(message.messageId); setEditText(message.text); setOpenMenuId(null); }} className="block w-full px-3 py-2 text-left">Edit</button>
                          {chatMeta.isGroup && <button onClick={() => { setOpenMenuId(null); openMessageViewers(message.messageId); }} className="block w-full px-3 py-2 text-left">View status</button>}
                          <button onClick={() => { setChats((prev) => prev.filter((item) => item.messageId !== message.messageId)); setOpenMenuId(null); socket.emit("delete_message", { chatId, messageId: message.messageId }); }} className="block w-full px-3 py-2 text-left text-red-500">Delete</button>
                        </>
                      ) : (
                        <button onClick={() => { navigator.clipboard.writeText(message.text || ""); setOpenMenuId(null); }} className="block w-full px-3 py-2 text-left">Copy</button>
                      )}
                    </div>
                  )}

                  <div className={`rounded-3xl bg-white p-3 shadow ${isSender ? "rounded-br-none" : "rounded-bl-none"}`}>
                    {message.storyReply?.storyId && (
                      <div className="mb-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Story reply</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {message.storyReply.previewText || (message.storyReply.mediaType === "video" ? "Video story" : message.storyReply.mediaType === "image" ? "Photo story" : "Story")}
                        </p>
                      </div>
                    )}

                    {message.type === "media" && message.media && (
                      <img src={message.media.url} alt="media" className="mb-2 h-72 w-72 max-w-full rounded-2xl object-cover" />
                    )}
                    {message.text && <p>{message.text}</p>}

                    <div className="mt-1 text-right text-[11px] text-gray-400">
                      {formatTime(message.createdAt)}
                      {message.edited && <span className="ml-1">edited</span>}
                      {isSender && !chatMeta.isGroup && (
                        <span className="ml-1 text-gray-400">
                          {message.status === "read" ? <span className="text-blue-400">✓✓</span> : message.status === "delivered" ? "✓✓" : "✓"}
                        </span>
                      )}
                      {isSender && chatMeta.isGroup && (
                        <button onClick={() => openMessageViewers(message.messageId)} className="ml-2 inline-flex items-center gap-1 text-slate-500">
                          <Eye className="h-3 w-3" />
                          {getGroupStatusLabel(message)}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div id="chat-end" />
        </div>
      </div>

      {preview && (
        <div className="mx-auto mb-2 max-w-xl px-4">
          <div className="relative inline-block">
            <img src={preview} className="max-h-40 rounded-lg border" alt="preview" />
            <button onClick={() => { setImage(null); setPreview(null); }} className="absolute -top-2 -right-2 rounded-full bg-black px-2 text-xs text-white">x</button>
          </div>
        </div>
      )}

      <div className="ml-4 text-sm text-gray-500">
        {Object.keys(typingUsers).filter((id) => typingUsers[id] && id !== myUserId).length > 0
          ? `${chatMeta.isGroup ? "Someone" : user?.full_name} is typing...`
          : ""}
      </div>

      <div className="px-4">
        <div className="mx-auto mb-5 flex max-w-xl items-center gap-3 rounded-full border bg-white p-2 pl-5">
          <input
            type="text"
            className="flex-1 outline-none"
            placeholder="Type a message..."
            value={editingId ? editText : text}
            onChange={(e) => {
              if (editingId) setEditText(e.target.value);
              else setText(e.target.value);
              socket.emit("typing", { chatId, isTyping: true });
              clearTimeout(window.__typingTimeout);
              window.__typingTimeout = setTimeout(() => socket.emit("typing", { chatId, isTyping: false }), 1500);
            }}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />

          <label>
            <ImageIcon className="size-7 cursor-pointer text-gray-400" />
            <input
              type="file"
              hidden
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
                if (!allowedImageTypes.includes(file.type)) {
                  toast("Only images are allowed");
                  return;
                }
                setImage(file);
                setPreview(URL.createObjectURL(file));
              }}
            />
          </label>

          <button onClick={sendMessage} disabled={disabled} className={`rounded-full p-2 text-white ${disabled ? "bg-gray-400" : "bg-slate-950"}`}>
            <SendHorizonal size={18} />
          </button>
        </div>
      </div>

      {viewerModal && (
        <div className="fixed inset-0 z-[120] bg-black/50 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-12 max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Message status</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">Delivered and seen</h3>
              </div>
              <button onClick={() => setViewerModal(null)} className="rounded-full bg-slate-100 px-3 py-1 text-sm">Close</button>
            </div>
            <div className="mt-4 space-y-3">
              {viewerLoading && <p className="text-sm text-slate-500">Loading...</p>}
              {(viewerModal || []).map((viewer) => (
                <div key={viewer._id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar src={viewer.profile_picture} size="sm" alt={viewer.full_name} />
                    <div>
                      <p className="font-medium text-slate-900">{viewer.full_name}</p>
                      <p className="text-sm text-slate-500">@{viewer.username}</p>
                    </div>
                  </div>
                  <p className={viewer.read ? "text-blue-500" : viewer.delivered ? "text-slate-700" : "text-slate-400"}>
                    {viewer.read ? "Seen" : viewer.delivered ? "Delivered" : "Sent"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {groupSheetOpen && chatMeta?.isGroup && (
        <div className="fixed inset-0 z-[120] bg-black/50 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-4 flex max-h-[calc(100vh-2rem)] max-w-lg flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Group details</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">{chatMeta.groupName}</h3>
                <p className="mt-1 text-sm text-slate-500">{isGroupOwner ? "You are the group owner" : isGroupAdmin ? "You are an admin" : "You are a member"}</p>
              </div>
              <button onClick={() => setGroupSheetOpen(false)} className="rounded-full bg-slate-100 px-3 py-1 text-sm">Close</button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                <Avatar src={groupAvatarFile ? URL.createObjectURL(groupAvatarFile) : chatMeta.groupAvatar} size="xl" alt={chatMeta.groupName} />
                <div>
                  <p className="font-medium text-slate-900">Group photo</p>
                  <p className="mt-1 text-sm text-slate-500">Keep your group easy to spot in the inbox.</p>
                  {isGroupAdmin && (
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                      Choose photo
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          setGroupAvatarFile(file || null);
                          if (file) updateGroupAvatar(file);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">Members</p>
                <div className="mt-3 max-h-56 space-y-3 overflow-y-auto">
                  {(chatMeta.participants || []).map((member) => (
                    <div key={member._id} className="flex items-center justify-between rounded-2xl bg-white px-3 py-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/app/profile/${member._id}`)}
                        className="flex items-center gap-3 text-left"
                      >
                        <Avatar src={member.profile_picture} size="sm" alt={member.full_name} />
                        <div>
                          <p className="font-medium text-slate-900">{member.full_name}</p>
                          <p className="text-sm text-slate-500">@{member.username}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        {String(chatMeta.groupOwnerId) === String(member._id) && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">Owner</span>}
                        {String(chatMeta.groupOwnerId) !== String(member._id) && chatMeta.groupAdminIds?.includes(String(member._id)) && <span className="rounded-full bg-slate-950 px-2 py-1 text-[10px] font-semibold text-white">Admin</span>}
                        {isGroupAdmin && String(member._id) !== String(myUserId) && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setMemberMenuId((prev) => prev === String(member._id) ? null : String(member._id))}
                              className="rounded-full bg-slate-100 p-2 text-slate-600"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {memberMenuId === String(member._id) && (
                              <div className="absolute right-0 top-10 z-20 min-w-[9rem] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                                {isGroupAdmin && !chatMeta.groupAdminIds?.includes(String(member._id)) && (
                                  <button
                                    disabled={groupActionLoading}
                                    onClick={() => {
                                      setMemberMenuId(null);
                                      updateMemberRole(member._id, "promote");
                                    }}
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    Make admin
                                  </button>
                                )}
                                {isGroupAdmin && chatMeta.groupAdminIds?.includes(String(member._id)) && String(chatMeta.groupOwnerId) !== String(member._id) && (
                                  <>
                                    <button
                                      disabled={groupActionLoading}
                                      onClick={() => {
                                        setMemberMenuId(null);
                                        updateMemberRole(member._id, "demote");
                                      }}
                                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                      Remove admin
                                    </button>
                                    {isGroupOwner && (
                                      <button
                                        disabled={groupActionLoading}
                                        onClick={() => {
                                          setMemberMenuId(null);
                                          updateMemberRole(member._id, "transfer-owner");
                                        }}
                                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50"
                                      >
                                        Make owner
                                      </button>
                                    )}
                                  </>
                                )}
                                {((!chatMeta.groupAdminIds?.includes(String(member._id))) || isGroupOwner) && String(chatMeta.groupOwnerId) !== String(member._id) && (
                                  <button
                                    disabled={groupActionLoading}
                                    onClick={() => {
                                      setMemberMenuId(null);
                                      removeMember(member._id);
                                    }}
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {isGroupAdmin && (
                <>
                  <div className="mt-5">
                    <label className="text-sm font-medium text-slate-900">Rename group</label>
                    <div className="mt-2 flex gap-2">
                      <input value={groupName} onChange={(e) => setGroupName(e.target.value)} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none" />
                      <button disabled={groupActionLoading} onClick={renameGroup} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Save</button>
                    </div>
                  </div>

                  {!!availableMembers.length && (
                    <div className="mt-5">
                      <p className="text-sm font-medium text-slate-900">Add members</p>
                      <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
                        {availableMembers.map((person) => {
                          const checked = selectedMembers.includes(String(person._id));
                          return (
                            <label key={person._id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 ${checked ? "border-slate-950 bg-slate-50" : "border-slate-200"}`}>
                              <input type="checkbox" checked={checked} onChange={() => setSelectedMembers((prev) => checked ? prev.filter((id) => id !== String(person._id)) : [...prev, String(person._id)])} />
                              <Avatar src={person.profile_picture} size="sm" alt={person.full_name} />
                              <div>
                                <p className="font-medium text-slate-900">{person.full_name}</p>
                                <p className="text-sm text-slate-500">@{person.username}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <button disabled={groupActionLoading || !selectedMembers.length} onClick={addMembers} className="mt-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
                        Add selected members
                      </button>
                    </div>
                  )}
                </>
              )}

              <button disabled={groupActionLoading} onClick={handleLeaveGroup} className="mt-6 w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                Leave group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBox;
