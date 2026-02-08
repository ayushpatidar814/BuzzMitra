import React, { useEffect, useRef, useState } from "react";
import { ImageIcon, SendHorizonal, MoreVertical } from "lucide-react";
import { useParams } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import api from "../../api/axios.js";
import Loading from "../../components/Loading.jsx";
import formatTime from "../../utils/formatTime.js";
import { useSocket } from "../../hooks/useSocket.js";
import { useDispatch } from "react-redux";
import { resetChatUnread } from "../../features/messagesWS/chatCountSlice.js";

const ChatBox = () => {
  const { chatId } = useParams();
  const { getToken } = useAuth();
  
  const { user: loggedInUser } = useUser();
  const myUserId = loggedInUser?.id;

  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [disabled, setDisabled] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");


  const socket = useSocket();
  const dispatch = useDispatch();
  const joinedChatsRef = useRef(new Set());

  /* -------------------- FETCH INITIAL MESSAGES -------------------- */
  useEffect(() => {
    if (!chatId) return;

    const fetchMessages = async () => {
      try {
        const token = await getToken();
        const { data } = await api.get(`/api/chat/messages/${chatId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (data.success) {
          setChats(data.data.messages || []);
          setUser(data.data.receiver);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchMessages();
  }, [chatId, getToken]);



  /* -------------------- SOCKET LISTENER -------------------- */
  useEffect(() => {
    if (!chatId || !socket) return;
    if (joinedChatsRef.current.has(chatId)) return;

    socket.emit("join_chat", chatId );
    joinedChatsRef.current.add( chatId );
    
    const handleNewMessage = (message) => {
      if (String(message.chatId) !== String(chatId)) return;

      setChats((prev) => {
        const exists = prev.some(
          (m) => m.messageId === message.messageId
        );
        if (exists) return prev;

        return [...prev, message];
      });
    };

    const handleUserTyping = ({ chatId, isTyping }) => {
      if (!chatId) return;
      setTypingUsers((prev) => ({ ...prev, [chatId]: isTyping }));
    };

    const handleMessageDeleted = ({ messageId }) => {
      setChats((prev) => prev.filter((m) => m.messageId !== messageId));
    };

    const handleMessageEdited = ({ messageId, text }) => {
      setChats((prev) =>
        prev.map((m) =>
          m.messageId === messageId ? { ...m, text, edited: true } : m
        )
      );
    };

    const handleDelivered = ({ messageId }) => {
      setChats((prev) =>
        prev.map((m) => m.messageId === messageId && m.status !== "read" ? { ...m, status: "delivered" } : m)
      );
    };

    const handleRead = ({ messageId }) => {
      setChats((prev) =>
        prev.map((m) => (m.messageId === messageId ? { ...m, status: "read" } : m))
      );
    };

    socket.on("new_message", handleNewMessage);
    socket.on("typing", handleUserTyping);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("message_edited", handleMessageEdited);
    socket.on("message_delivered", handleDelivered);
    socket.on("message_read", handleRead);  
    
    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("typing", handleUserTyping);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("message_edited", handleMessageEdited);
      socket.off("message_delivered", handleDelivered);
      socket.off("message_read", handleRead);
    };
  }, [chatId, socket]);

  /* -------------------- MARK MESSAGES AS READ -------------------- */
  useEffect(() => {
    if (!chatId || !socket || chats.length === 0) return;

    dispatch(resetChatUnread(chatId));
    
    socket.emit("read_messages", { chatId });
  }, [chatId, socket, chats.length]);

  useEffect(() => {
    if (!socket || !myUserId) return;
    socket.emit("join_user", myUserId);
  }, [socket, myUserId]);



/* -------------------- SEND MESSAGE -------------------- */
  const sendMessage = async () => {
    if ((!text.trim() && !image && !editText.trim()) || !chatId || !user?._id) return;
    
    if (editingId) {
      // Optimistic UI update
      setChats((prev) =>
        prev.map((m) =>
          m.messageId === editingId ? { ...m, text: editText, edited: true } : m
        )
      );

      socket.emit("edit_message", {
        chatId,
        messageId: editingId,
        text: editText,
      });

      setEditingId(null);
      setEditText("");
      return;
    }
    
    const messageId = crypto.randomUUID();
    setDisabled(true);
    
    let uploadedMedia = null;

    try {
    
      if (image) {
        const token = await getToken();
        const formData = new FormData();
        formData.append("media", image);

        const res = await api.post("/api/chat/uploadMedia", formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });

        uploadedMedia = res.data.media; 
      }

      // Prepare message payload
      const payload = {
        chatId,
        receiverId: user._id,
        messageId,
        text: text.trim(),
        type: uploadedMedia ? "media" : "text",
        media: uploadedMedia || null, 
      };

      // Optimistic UI update
      setChats((prev) => [...prev, { ...payload, senderId: myUserId, status: "sent", createdAt: new Date().toISOString() }]);
      
      // Emit message over socket
      socket.connected && socket.emit("send_message", payload);
      
      setText("");
      setImage(null);
      setPreview(null);
    } catch (error) {
      console.error(error);
    } finally {
      setDisabled(false);
    }
  };


  const startEdit = (message) => {
    setEditingId(message.messageId);
    setEditText(message.text);
    setOpenMenuId(null);
  };

  const deleteMessage = (messageId) => {
    // optimistic UI
    setChats((prev) => prev.filter((m) => m.messageId !== messageId));
    setOpenMenuId(null);

    socket.emit("delete_message", {
      chatId,
      messageId,
    });
  };

  const copyMessage = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setOpenMenuId(null);
  };

 
  /* -------------------- UI HELPERS -------------------- */
  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    document.getElementById("chat-end")?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);


  if (!user) return <Loading />;

  return (
    <div className="flex flex-col h-screen bg-[url('/chatbox_background.png')]">
      {/* Header */}
      <div className="flex items-center gap-2 p-2 md:px-10 bg-slate-100 border-b">
        <img
          src={user.profile_picture}
          className="size-8 rounded-full"
          alt={user.full_name}
        />
        <div>
          <p className="font-medium">{user.full_name}</p>
          <p className="text-sm text-gray-500">@{user.username}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="p-5 md:px-10 h-full overflow-y-scroll">
        <div className="space-y-4 max-w-6xl mx-auto">
          {chats.map((message) => {
            const isSender = message.senderId === myUserId;

            return (
              <div
                key={`${message.messageId}-${message.createdAt}`}
                className={`flex ${isSender ? "justify-end" : "justify-start"} group`}
              >
                <div className="relative max-w-sm">
                  {/* THREE DOTS */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenMenuId(openMenuId === message.messageId ? null : message.messageId)
                    }
                    }
                    className={`absolute top-1 ${
                      !isSender ? "left-0" : "right-0"
                    } hidden group-hover:block text-gray-600 hover:text-gray-800`}
                  >
                    <MoreVertical size={16} />
                  </button>

                  {/* DROPDOWN */}
                  {openMenuId === message.messageId && (
                    <div
                      className={`absolute z-10 mt-2 w-32 bg-gray-50 border rounded-xl shadow-md text-sm ${
                        !isSender ? "left-4" : "right-4"
                      }`}
                    >
                      {isSender ? (
                        <>
                          <button onClick={() => startEdit(message)} className="block w-full px-3 py-2 hover:bg-gray-100 text-left">
                            Edit
                          </button>
                          <button onClick={() => deleteMessage(message.messageId)} className="block w-full px-3 py-2 hover:bg-gray-100 text-left text-red-500">
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => copyMessage(message.text)} className="block w-full px-3 py-2 hover:bg-gray-100 text-left">
                            Copy
                          </button>
                          <button className="block w-full px-3 py-2 hover:bg-gray-100 text-left text-red-500">
                            Report
                          </button>
                        </>
                      )}
                    </div>
                  )}
                <div
                  className={`p-2 px-3 text-base max-w-sm bg-white rounded-lg shadow ${
                    isSender ? "rounded-br-none" : "rounded-bl-none"
                  }`}
                >
                  {/* IMAGE */}
                  {message.type === "media" && message.media && (
                    <img
                      src={message.media.url}
                      alt="media"
                      className="w-full max-w-xs rounded-lg mb-1"
                    />
                  )}

                  {/* TEXT */}
                  {message.text && <p>{message.text}</p>}


                  {/* TIME */}
                  <div className="text-[11px] text-gray-400 text-right mt-1">
                    {formatTime(message.createdAt)}
                  
                  {message.edited && (
                    <span className="ml-1">edited</span>
                  )}

                  {/* Status (only for sender) */}
                  {isSender && (
                    <span className="ml-1 text-gray-400">
                      {message.status === "read"
                        ? <span className="text-blue-400">✓✓</span>
                        : message.status === "delivered"
                        ? "✓✓"
                        : "✓"}
                    </span>
                  )}

                  </div>

                </div>
              </div>
              </div>
            );
          })}
          <div />
          <div id="chat-end" />
        </div>
      </div>


      {preview && (
        <div className="max-w-xl mx-auto mb-2 px-4">
          <div className="relative inline-block">
            <img src={preview} className="max-h-40 rounded-lg border" />
            <button
              onClick={() => {
                setImage(null);
                setPreview(null);
              }}
              className="absolute -top-2 -right-2 bg-black text-white text-xs rounded-full px-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="text-sm text-gray-500 ml-2">
        {Object.keys(typingUsers)
          .filter((id) => typingUsers[id] && id !== myUserId)
          .map(() => user?.full_name + " is typing...")
          .join(", ")}
      </div>

      {/* Input */}
      <div className="px-4">
        <div className="flex items-center gap-3 pl-5 p-1.5 bg-white max-w-xl mx-auto border rounded-full mb-5">
          <input
            id="chat-input"
            type="text"
            className="flex-1 outline-none"
            placeholder="Type a message..."
            value={editingId ? editText : text}
            onChange={(e) => {
              if (editingId) setEditText(e.target.value);
              else setText(e.target.value);
              
              socket.emit("typing", { chatId, isTyping: true });

              clearTimeout(window.__typingTimeout);
              window.__typingTimeout = setTimeout(() => {
                socket.emit("typing", { chatId, isTyping: false });
              }, 1500);
            }}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />

          <label>
            <ImageIcon className="size-7 text-gray-400 cursor-pointer" />
            <input
              type="file"
              hidden
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                setImage(file);
                setPreview(URL.createObjectURL(file));
              }}
            />
          </label>

          <button
            onClick={sendMessage}
            disabled={disabled}
            className={`p-2 rounded-full text-white ${
              disabled
                ? "bg-gray-400"
                : "bg-gradient-to-br from-indigo-500 to-purple-600"
            }`}
          >
            <SendHorizonal size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBox;
