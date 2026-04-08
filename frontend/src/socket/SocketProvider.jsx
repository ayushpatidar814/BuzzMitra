import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { socket } from "./socket";
import { incrementUnread, resetAllUnread, setInitialCounts, setUnreadChatsCount } from "../features/messagesWS/chatCountSlice";
import { useAuth } from "../auth/AuthProvider";
import api from "../api/axios";

const SocketProvider = ({ children }) => {
  const { token, isAuthenticated, authHeaders } = useAuth();
  const user = useSelector((state) => state.user.value);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!isAuthenticated || !token || !user?._id) return;

    socket.auth = { token };
    socket.connect();

    api.get("/api/chat/chats", { headers: authHeaders })
      .then(({ data }) => {
        if (data.success) {
          dispatch(setInitialCounts(data.data));
        }
      })
      .catch(() => {});

    const onConnect = () => {
      socket.emit("join_user", user._id);
    };

    const onInbox = (message) => {
      if (String(message.senderId) !== String(user._id)) {
        dispatch(incrementUnread(message.chatId));
      }
    };

    const onUnreadChatsCount = ({ count }) => {
      dispatch(setUnreadChatsCount(count));
    };

    socket.on("connect", onConnect);
    socket.on("inbox_message", onInbox);
    socket.on("unread_chats_count", onUnreadChatsCount);

    return () => {
      socket.off("connect", onConnect);
      socket.off("inbox_message", onInbox);
      socket.off("unread_chats_count", onUnreadChatsCount);
      socket.disconnect();
      dispatch(resetAllUnread());
    };
  }, [token, isAuthenticated, user?._id, dispatch, authHeaders]);

  return children;
};

export default SocketProvider;
