import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { socket } from "./socket";
import { incrementUnread, resetAllUnread, setInitialCounts, setUnreadChatsCount } from "../features/messagesWS/chatCountSlice";
import { useAuth } from "../auth/AuthProvider";
import api from "../api/axios";
import {
  incrementUnreadNotifications,
  resetNotificationsState,
  setUnreadNotificationsCount,
} from "../features/notifications/notificationsSlice";
import toast from "react-hot-toast";
import Notification from "../components/Notification";

const SocketProvider = ({ children }) => {
  const { token, isAuthenticated, authHeaders } = useAuth();
  const user = useSelector((state) => state.user.value);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!isAuthenticated || !token || !user?._id) return;

    socket.auth = { token };
    socket.connect();

    api.getDedup("/api/chat/chats", { headers: authHeaders })
      .then(({ data }) => {
        if (data.success) {
          dispatch(setInitialCounts(data.data));
        }
      })
      .catch(() => {});

    api.getDedup("/api/notifications/unread-count", { headers: authHeaders })
      .then(({ data }) => {
        if (data.success) {
          dispatch(setUnreadNotificationsCount(data.unreadCount || data.data?.unreadCount || 0));
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

    const onInboxBatch = (messages = []) => {
      messages.forEach(onInbox);
    };

    const onUnreadChatsCount = ({ count }) => {
      dispatch(setUnreadChatsCount(count));
    };

    const onUnreadChatsCountBatch = (payload = []) => {
      const latest = payload[payload.length - 1];
      if (latest) onUnreadChatsCount(latest);
    };

    const onNotification = (notification) => {
      dispatch(incrementUnreadNotifications());
      toast.custom((t) => <Notification t={t} notification={notification} />, { duration: 5000 });
    };

    const onNotificationBatch = (items = []) => {
      items.forEach(onNotification);
    };

    const onNotificationUnreadCount = ({ count }) => {
      dispatch(setUnreadNotificationsCount(count));
    };

    socket.on("connect", onConnect);
    socket.on("inbox_message", onInbox);
    socket.on("inbox_message_batch", onInboxBatch);
    socket.on("unread_chats_count", onUnreadChatsCount);
    socket.on("unread_chats_count_batch", onUnreadChatsCountBatch);
    socket.on("notification:new", onNotification);
    socket.on("notification:new_batch", onNotificationBatch);
    socket.on("notification:unread_count", onNotificationUnreadCount);

    return () => {
      socket.off("connect", onConnect);
      socket.off("inbox_message", onInbox);
      socket.off("inbox_message_batch", onInboxBatch);
      socket.off("unread_chats_count", onUnreadChatsCount);
      socket.off("unread_chats_count_batch", onUnreadChatsCountBatch);
      socket.off("notification:new", onNotification);
      socket.off("notification:new_batch", onNotificationBatch);
      socket.off("notification:unread_count", onNotificationUnreadCount);
      socket.disconnect();
      dispatch(resetAllUnread());
      dispatch(resetNotificationsState());
    };
  }, [token, isAuthenticated, user?._id, dispatch, authHeaders]);

  return children;
};

export default SocketProvider;
